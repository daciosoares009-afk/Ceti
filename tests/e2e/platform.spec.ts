import { test, expect } from "@playwright/test";
import { createDatabaseClient } from "../../packages/database/src/index";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { passwordHash, encryptSecret, totpCode } from "../../apps/web/src/modules/security/crypto";
const db = createDatabaseClient(process.env.TEST_DATABASE_URL);
const prefix = randomUUID();
const email = `e2e-${prefix}@example.test`;
const password = "e2e-test-password-123";
const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
let schoolId: string, managerId: string, membershipId: string;
test.beforeAll(async () => {
  const school = await db.school.create({ data: { name: "Escola de teste E2E", slug: `e2e-${prefix}` } }); schoolId = school.id;
  const manager = await db.user.create({ data: { name: "Gestor E2E", email, passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), mfaSecret: encryptSecret(secret, "a".repeat(64)), memberships: { create: { schoolId, role: "MANAGER", status: "APPROVED" } } } }); managerId = manager.id;
  const student = await db.user.create({ data: { name: "Aluno E2E", email: `student-${prefix}@example.test`, passwordHash: await passwordHash(password), emailVerifiedAt: new Date(), memberships: { create: { schoolId, role: "STUDENT", status: "PENDING_REVIEW" } } }, include: { memberships: true } }); membershipId = student.memberships[0].id;
});
test.afterAll(async () => {
  if (schoolId) {
    const ids = (await db.membership.findMany({ where: { schoolId }, select: { userId: true } })).map(m => m.userId);
    await db.auditEvent.deleteMany({ where: { OR: [{ schoolId }, { actorId: { in: ids } }] } });
    await db.membership.deleteMany({ where: { schoolId } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.school.delete({ where: { id: schoolId } });
  }
  await db.$disconnect();
});
test("MFA, aprovação real, acesso por perfil e revogação", async ({ page }) => {
  await page.goto("/entrar");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  if (process.env.CAPTURE_UI) { mkdirSync(".local/screenshots", { recursive: true }); await page.screenshot({ path: ".local/screenshots/login-desktop.png", fullPage: true }); }
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByText("Sou gestor e uso autenticação em duas etapas").click();
  await page.getByLabel("Código do autenticador").fill(totpCode(secret, Math.floor(Date.now() / 30000)));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "Olá, Gestor." })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  if (process.env.CAPTURE_UI) await page.screenshot({ path: ".local/screenshots/dashboard-test.png", fullPage: true });
  await page.getByRole("link", { name: "Gestão de acessos" }).click();
  await expect(page.getByText("Aluno E2E", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect.poll(async () => (await db.membership.findUniqueOrThrow({ where: { id: membershipId } })).status).toBe("APPROVED");
  await page.getByRole("link", { name: "Minha conta", exact: true }).first().click();
  await page.getByRole("button", { name: "Sair de todos os dispositivos" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect(await db.session.count({ where: { userId: managerId } })).toBe(0);
  await page.getByLabel("E-mail", { exact: true }).fill(`student-${prefix}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Acesso aprovado", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gestão de acessos" })).toHaveCount(0);
  const forbidden = await page.request.get(`/api/management?schoolId=${schoolId}`);
  expect(forbidden.status()).toBe(403);
});
test("layout móvel e proteção HTTP", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Seu próximo passo começa aqui." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  if (process.env.CAPTURE_UI) { mkdirSync(".local/screenshots", { recursive: true }); await page.screenshot({ path: ".local/screenshots/register-mobile.png", fullPage: true }); }
  const denied = await request.post("/api/auth/login", { headers: { Origin: "https://attacker.example" }, data: { email, password } });
  expect(denied.status()).toBe(403);
  expect(denied.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(denied.headers()["x-content-type-options"]).toBe("nosniff");
});
