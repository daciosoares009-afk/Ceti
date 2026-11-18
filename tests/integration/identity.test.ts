import "dotenv/config";
import { SMTPServer } from "smtp-server";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { digest, encryptSecret, newToken, passwordHash, totpCode } from "../../apps/web/src/modules/security/crypto";
let db: PrismaClient;
let identity: typeof import("../../apps/web/src/modules/identity/service");
let schools: typeof import("../../apps/web/src/modules/schools/service");
let limiter: typeof import("../../apps/web/src/modules/security/rate-limit");
let worker: typeof import("../../apps/web/src/modules/identity/email-worker");
let server: SMTPServer;
const inbox: { to: string; body: string }[] = [];
const prefix = randomUUID();
const password = "integration-test-password-123";
const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
let schoolA: string, schoolB: string, managerId: string;
let session: NonNullable<Awaited<ReturnType<typeof identity.getSession>>>;
const users: string[] = [];
function email(label: string) { return `${label}-${prefix}@example.test`; }
beforeAll(async () => {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("Configure TEST_DATABASE_URL; integration tests are never silently skipped.");
  const url = new URL(value);
  if (!url.pathname.endsWith("_test") || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Dedicated local *_test database required");
  process.env.DATABASE_URL = value;
  process.env.APP_URL = "http://localhost:3000";
  process.env.MFA_ENCRYPTION_KEY = "a".repeat(64);
  process.env.SMTP_HOST = "127.0.0.1"; process.env.SMTP_PORT = "11026"; process.env.SMTP_SECURE = "false"; process.env.SMTP_FROM = "test@example.test";
  delete process.env.SMTP_USER; delete process.env.SMTP_PASSWORD;
  server = new SMTPServer({ authOptional: true, disabledCommands: ["AUTH", "STARTTLS"],
    onRcptTo(address, smtpSession, callback) { callback(address.address.startsWith("failure-") ? new Error("Intentional test rejection") : undefined); },
    onData(stream, smtpSession, callback) {
    let body = ""; stream.on("data", chunk => { body += chunk.toString(); }); stream.on("end", () => { inbox.push({ to: smtpSession.envelope.rcptTo[0].address, body }); callback(); });
  } });
  await new Promise<void>(resolve => server.listen(11026, "127.0.0.1", resolve));
  db = (await import("../../packages/database/src/index")).db;
  identity = await import("../../apps/web/src/modules/identity/service");
  schools = await import("../../apps/web/src/modules/schools/service");
  limiter = await import("../../apps/web/src/modules/security/rate-limit");
  worker = await import("../../apps/web/src/modules/identity/email-worker");
  schoolA = (await db.school.create({ data: { name: "Escola de integração A", slug: `test-a-${prefix}` } })).id;
  schoolB = (await db.school.create({ data: { name: "Escola de integração B", slug: `test-b-${prefix}` } })).id;
  const manager = await db.user.create({ data: { name: "Gestor de teste", email: email("manager"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), mfaSecret: encryptSecret(secret, process.env.MFA_ENCRYPTION_KEY), memberships: { create: { schoolId: schoolA, role: "MANAGER", status: "APPROVED" } } } });
  users.push(manager.id); managerId = manager.id;
  const code = totpCode(secret, Math.floor(Date.now() / 30000));
  const result = await identity.login({ email: manager.email, password, code });
  session = (await identity.getSession(result.token))!;
});
afterAll(async () => {
  if (db) {
    const accounts = await db.user.findMany({ where: { email: { endsWith: `-${prefix}@example.test` } }, select: { id: true } });
    const ids = [...users, ...accounts.map(u => u.id)];
    await db.auditEvent.deleteMany({ where: { OR: [{ schoolId: { in: [schoolA, schoolB].filter(Boolean) } }, { actorId: { in: ids } }] } });
    await db.membership.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.school.deleteMany({ where: { id: { in: [schoolA, schoolB].filter(Boolean) } } });
    await db.rateLimit.deleteMany({ where: { key: { in: [digest(`integration:${prefix}`)] } } });
    await db.$disconnect();
  }
  if (server) await new Promise<void>(resolve => server.close(resolve));
});
describe("PostgreSQL + SMTP reais: identidade e escolas", () => {
  it("cadastro → e-mail → aprovação → sessão, com isolamento entre escolas", async () => {
    const input = { name: "Aluno de integração", email: email("student"), password, schoolId: schoolA, role: "STUDENT" as const };
    expect(await identity.register(input)).toBe(identity.genericEmailMessage);
    let user = await db.user.findUniqueOrThrow({ where: { email: input.email }, include: { memberships: true } });
    expect(user.emailVerifiedAt).toBeNull(); expect(user.memberships[0].status).toBe("PENDING_EMAIL");
    await expect(identity.login({ email: input.email, password })).rejects.toMatchObject({ status: 403 });
    expect(await db.emailJob.count({ where: { token: { userId: user.id } } })).toBe(1);
    const delivery = await worker.deliverEmailBatch();
    expect(delivery.delivered).toBeGreaterThan(0);
    expect(await db.emailJob.count({ where: { token: { userId: user.id } } })).toBe(0);
    const mail = inbox.find(m => m.to === input.email)!;
    expect(mail).toBeDefined();
    const token = mail.body.replace(/=\r?\n/g, "").replaceAll("=3D", "=").match(/#token=([\w-]{43})/)![1];
    expect((await db.actionToken.findFirstOrThrow({ where: { userId: user.id } })).tokenHash).toBe(digest(token));
    await identity.consumeToken(token, "VERIFY_EMAIL");
    await expect(identity.consumeToken(token, "VERIFY_EMAIL")).rejects.toMatchObject({ status: 400 });
    user = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { memberships: true } });
    expect(user.memberships[0].status).toBe("PENDING_REVIEW");
    const loginResult = await identity.login({ email: input.email, password });
    const student = (await identity.getSession(loginResult.token))!;
    await expect(schools.reviewMembership(student, { schoolId: schoolA, membershipId: user.memberships[0].id, decision: "APPROVED" })).rejects.toMatchObject({ status: 403 });
    await schools.reviewMembership(session, { schoolId: schoolA, membershipId: user.memberships[0].id, decision: "APPROVED" });
    expect((await identity.getSession(loginResult.token))!.user.memberships[0].status).toBe("APPROVED");
    await schools.joinSchool(student, { schoolId: schoolB, role: "TEACHER" });
    const other = await db.membership.findUniqueOrThrow({ where: { userId_schoolId: { userId: user.id, schoolId: schoolB } } });
    await expect(schools.reviewMembership(session, { schoolId: schoolB, membershipId: other.id, decision: "APPROVED" })).rejects.toMatchObject({ status: 403 });
    await expect(schools.reviewMembership(session, { schoolId: schoolA, membershipId: other.id, decision: "APPROVED" })).rejects.toMatchObject({ status: 404 });
    await expect(schools.managementData(student, schoolA)).rejects.toMatchObject({ status: 403 });
    await schools.reviewMembership(session, { schoolId: schoolA, membershipId: user.memberships[0].id, decision: "SUSPENDED" });
    const refreshed = (await identity.getSession(loginResult.token))!;
    expect(refreshed.user.memberships.find(m => m.schoolId === schoolA)?.status).toBe("SUSPENDED");
    expect(refreshed.user.memberships.find(m => m.schoolId === schoolB)?.status).toBe("PENDING_REVIEW");
    await identity.logout(loginResult.token, true);
    expect(await identity.getSession(loginResult.token)).toBeNull();
  });
  it("não enumera contas em cadastro repetido, recuperação ou login inválido", async () => {
    const input = { name: "Teste duplicado", email: email("duplicate"), password, schoolId: schoolA, role: "TEACHER" as const };
    expect(await identity.register(input)).toBe(await identity.register(input));
    expect(await db.user.count({ where: { email: input.email } })).toBe(1);
    expect(await identity.requestEmail(email("missing"), "RESET_PASSWORD")).toBe(identity.genericEmailMessage);
    await expect(identity.login({ email: email("missing"), password })).rejects.toMatchObject({ status: 401 });
    await expect(identity.login({ email: input.email, password: "wrong" })).rejects.toMatchObject({ status: 401 });
  });
  it("MFA é obrigatório e um código já usado não pode ser reutilizado", async () => {
    await expect(identity.login({ email: email("manager"), password })).rejects.toMatchObject({ status: 401 });
    const manager = await db.user.findUniqueOrThrow({ where: { id: managerId } });
    await expect(identity.login({ email: manager.email, password, code: totpCode(secret, Number(manager.mfaLastStep)) })).rejects.toMatchObject({ status: 401 });
  });
  it("consome recuperação atomicamente e revoga todas as sessões", async () => {
    const user = await db.user.create({ data: { name: "Conta de recuperação", email: email("reset"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date() } }); users.push(user.id);
    const login = await identity.login({ email: user.email, password });
    const token = newToken(); await db.actionToken.create({ data: { userId: user.id, tokenHash: digest(token), purpose: "RESET_PASSWORD", expiresAt: new Date(Date.now() + 60000) } });
    const results = await Promise.allSettled([identity.consumeToken(token, "RESET_PASSWORD", "new-test-password-456"), identity.consumeToken(token, "RESET_PASSWORD", "new-test-password-456")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await identity.getSession(login.token)).toBeNull();
    await expect(identity.login({ email: user.email, password })).rejects.toMatchObject({ status: 401 });
    expect((await identity.login({ email: user.email, password: "new-test-password-456" })).token).toHaveLength(43);
  });
  it("rejeita tokens expirados, conta suspensa e sessão desconhecida", async () => {
    const user = await db.user.create({ data: { name: "Conta suspensa", email: email("suspended"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), status: "SUSPENDED" } }); users.push(user.id);
    await expect(identity.login({ email: user.email, password })).rejects.toMatchObject({ status: 401 });
    const token = newToken(); await db.actionToken.create({ data: { userId: user.id, tokenHash: digest(token), purpose: "VERIFY_EMAIL", expiresAt: new Date(0) } });
    await expect(identity.consumeToken(token, "VERIFY_EMAIL")).rejects.toMatchObject({ status: 400 });
    expect(await identity.getSession(newToken())).toBeNull();
  });
  it("rate limit compartilhado conta incrementos concorrentes atomicamente", async () => {
    const result = await Promise.allSettled(Array.from({ length: 8 }, () => limiter.rateLimit("integration", prefix, 3, 60)));
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(3);
    expect(result.filter(r => r.status === "rejected")).toHaveLength(5);
  });
  it("expiração usa instantes, independentemente do fuso do servidor PostgreSQL", async () => {
    const zone = await db.$queryRaw<{ zone: string }[]>`SELECT current_setting('TimeZone') AS zone`;
    expect(zone[0].zone).toBe("UTC");
    const token = newToken();
    await db.actionToken.create({ data: { userId: managerId, tokenHash: digest(token), purpose: "VERIFY_EMAIL", expiresAt: new Date(Date.now() - 1000) } });
    await expect(identity.consumeToken(token, "VERIFY_EMAIL")).rejects.toMatchObject({ status: 400 });
    const column = await db.$queryRaw<{ data_type: string }[]>`SELECT data_type FROM information_schema.columns WHERE table_name = 'ActionToken' AND column_name = 'expiresAt'`;
    expect(column[0].data_type).toBe("timestamp with time zone");
  });
  it("duas decisões concorrentes não aprovam e recusam o mesmo vínculo", async () => {
    const user = await db.user.create({ data: { name: "Conta concorrente", email: email("race"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), memberships: { create: { schoolId: schoolA, role: "STUDENT", status: "PENDING_REVIEW" } } }, include: { memberships: true } }); users.push(user.id);
    const input = { schoolId: schoolA, membershipId: user.memberships[0].id };
    const results = await Promise.allSettled([schools.reviewMembership(session, { ...input, decision: "APPROVED" }), schools.reviewMembership(session, { ...input, decision: "REJECTED" })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });
  it("falha SMTP mantém job persistente e respeita backoff e máximo de tentativas", async () => {
    const user = await db.user.create({ data: { name: "Conta de falha SMTP", email: email("failure"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date() } }); users.push(user.id);
    await identity.requestEmail(user.email, "RESET_PASSWORD");
    const result = await worker.deliverEmailBatch();
    expect(result.failed).toBe(1);
    const job = await db.emailJob.findFirstOrThrow({ where: { token: { userId: user.id } } });
    expect(job.attempts).toBe(1); expect(job.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect((await worker.deliverEmailBatch()).failed).toBe(0);
    await db.emailJob.update({ where: { id: job.id }, data: { attempts: 4, availableAt: new Date(0) } });
    expect((await worker.deliverEmailBatch()).failed).toBe(1);
    expect((await db.emailJob.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(5);
    expect((await worker.deliverEmailBatch()).failed).toBe(0);
  });
  it("revogação do gestor impede decisão mesmo usando uma sessão anteriormente lida", async () => {
    const user = await db.user.create({ data: { name: "Solicitação após revogação", email: email("revocation"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), memberships: { create: { schoolId: schoolA, role: "STUDENT", status: "PENDING_REVIEW" } } }, include: { memberships: true } }); users.push(user.id);
    const manager = session.user.memberships.find(m => m.schoolId === schoolA)!;
    await db.membership.update({ where: { id: manager.id }, data: { status: "SUSPENDED" } });
    try {
      await expect(schools.reviewMembership(session, { schoolId: schoolA, membershipId: user.memberships[0].id, decision: "APPROVED" })).rejects.toMatchObject({ status: 403 });
      expect((await db.membership.findUniqueOrThrow({ where: { id: user.memberships[0].id } })).status).toBe("PENDING_REVIEW");
    } finally { await db.membership.update({ where: { id: manager.id }, data: { status: "APPROVED" } }); }
  });
  it("workers concorrentes não entregam duas vezes um job com lease ativo", async () => {
    const user = await db.user.create({ data: { name: "Conta de outbox concorrente", email: email("worker-race"), passwordHash: await passwordHash(password), emailVerifiedAt: new Date() } }); users.push(user.id);
    await identity.requestEmail(user.email, "RESET_PASSWORD");
    await Promise.all([worker.deliverEmailBatch(), worker.deliverEmailBatch()]);
    expect(inbox.filter(m => m.to === user.email)).toHaveLength(1);
    expect(await db.emailJob.count({ where: { token: { userId: user.id } } })).toBe(0);
  });
  it("CLI provisiona gestor sem e-mail verificado, prova MFA e outbox atômica, sem ecoar segredos", async () => {
    const input = { name: "Gestor provisionado de teste", email: email("bootstrap"), password, schoolName: "Escola de integração A", schoolSlug: `test-a-${prefix}`, totpSecret: secret, totpCode: totpCode(secret, Math.floor(Date.now() / 30000)) };
    async function provision() {
      return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", "scripts/bootstrap.ts"], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }, stdio: ["pipe", "pipe", "pipe"] });
        let output = "";
        child.stdout.on("data", value => { output += value.toString(); }); child.stderr.on("data", value => { output += value.toString(); });
        child.on("error", reject); child.on("close", code => resolve({ code, output })); child.stdin.end(JSON.stringify(input));
      });
    }
    const result = await provision();
    expect(result.code).toBe(0); expect(result.output).not.toContain(password); expect(result.output).not.toContain(secret);
    const user = await db.user.findUniqueOrThrow({ where: { email: input.email }, include: { memberships: true } });
    expect(user.emailVerifiedAt).toBeNull(); expect(user.mfaSecret).not.toBe(secret);
    expect(user.memberships[0].role).toBe("MANAGER"); expect(user.memberships[0].status).toBe("APPROVED");
    expect(await db.emailJob.count({ where: { token: { userId: user.id } } })).toBe(1);
    await expect(identity.login({ email: user.email, password, code: input.totpCode })).rejects.toMatchObject({ status: 403 });
    expect((await provision()).code).toBe(1); expect(await db.user.count({ where: { email: input.email } })).toBe(1);
  });
});
