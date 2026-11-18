import { db } from "@ceti/database";
import { Prisma, TokenPurpose } from "@prisma/client";
import { z } from "zod";
import { registrationSchema, loginSchema } from "./validation";
import { digest, newToken, passwordHash, passwordMatches, decryptSecret, encryptSecret, verifyTotp } from "../security/crypto";
import { AppError } from "../security/errors";
import { env } from "../security/config";

export const genericEmailMessage = "Se os dados permitirem esta solicitação, você receberá um e-mail com os próximos passos.";
const dummyHash = passwordHash("only-used-for-equal-cost-verification-no-account");
const publicUser = { id: true, name: true, email: true, emailVerifiedAt: true, status: true } as const;

export async function enqueueActionEmail(userId: string, purpose: TokenPurpose, tx: Prisma.TransactionClient = db) {
  const token = newToken();
  await tx.actionToken.create({ data: { userId, purpose, tokenHash: digest(token), expiresAt: new Date(Date.now() + (purpose === "VERIFY_EMAIL" ? 86400000 : 1800000)),
    emailJob: { create: { tokenCiphertext: encryptSecret(token, digest(`${env().MFA_ENCRYPTION_KEY}:email-outbox-v1`)) } },
  } });
}
export async function register(input: z.infer<typeof registrationSchema>) {
  const school = await db.school.findFirst({ where: { id: input.schoolId, active: true }, select: { id: true } });
  if (!school) throw new AppError(400, "Selecione uma escola disponível.");
  const encoded = await passwordHash(input.password);
  try {
    await db.$transaction(async tx => {
    const user = await tx.user.create({ data: {
      name: input.name, email: input.email, passwordHash: encoded,
      memberships: { create: { schoolId: school.id, role: input.role } },
    }, select: { id: true } });
    await enqueueActionEmail(user.id, "VERIFY_EMAIL", tx);
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  return genericEmailMessage;
}
export async function requestEmail(email: string, purpose: TokenPurpose) {
  const user = await db.user.findUnique({ where: { email }, select: publicUser });
  if (user?.status === "ACTIVE" && (purpose === "RESET_PASSWORD" || !user.emailVerifiedAt)) await enqueueActionEmail(user.id, purpose);
  return genericEmailMessage;
}
export async function consumeToken(token: string, purpose: TokenPurpose, newPassword?: string) {
  const encoded = newPassword ? await passwordHash(newPassword) : undefined;
  await db.$transaction(async tx => {
    // DELETE RETURNING locks the token; concurrent consumers cannot both succeed.
    const tokens = await tx.$queryRaw<{ userId: string }[]>`
      DELETE FROM "ActionToken" WHERE "tokenHash" = ${digest(token)} AND "purpose" = ${purpose}::"TokenPurpose"
        AND "expiresAt" > NOW() RETURNING "userId"`;
    const userId = tokens[0]?.userId;
    if (!userId) throw new AppError(400, "Link inválido ou expirado. Solicite um novo e-mail.");
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") throw new AppError(400, "Link inválido ou expirado. Solicite um novo e-mail.");
    if (purpose === "VERIFY_EMAIL") {
      await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      await tx.membership.updateMany({ where: { userId, status: "PENDING_EMAIL" }, data: { status: "PENDING_REVIEW" } });
    } else {
      if (!encoded) throw new Error("Missing password");
      await tx.user.update({ where: { id: userId }, data: { passwordHash: encoded } });
      await tx.session.deleteMany({ where: { userId } });
    }
    await tx.actionToken.deleteMany({ where: { userId, purpose } });
    await tx.auditEvent.create({ data: { actorId: userId, action: purpose === "VERIFY_EMAIL" ? "EMAIL_VERIFIED" : "PASSWORD_RESET" } });
  });
}
export async function login(input: z.infer<typeof loginSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email }, include: { memberships: { where: { role: "MANAGER" } } } });
  const validPassword = await passwordMatches(user?.passwordHash ?? await dummyHash, input.password);
  const invalid = () => new AppError(401, "E-mail, senha ou código de autenticação inválidos.");
  if (!user || !validPassword || user.status !== "ACTIVE") throw invalid();
  if (!user.emailVerifiedAt) throw new AppError(403, "Confirme seu e-mail antes de entrar. Você pode solicitar um novo link.");
  const manager = user.memberships.length > 0;
  let step: number | null = null;
  if (manager) {
    if (!user.mfaSecret) throw invalid();
    step = verifyTotp(decryptSecret(user.mfaSecret, env().MFA_ENCRYPTION_KEY), input.code ?? "", user.mfaLastStep);
    if (step === null) throw invalid();
  }
  const token = newToken();
  const expiresAt = new Date(Date.now() + (manager ? 2 : 12) * 3600000);
  await db.$transaction(async tx => {
    const accounts = await tx.$queryRaw<{ passwordHash: string; status: string; emailVerifiedAt: Date | null }[]>`SELECT "passwordHash", "status", "emailVerifiedAt" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const account = accounts[0];
    if (!account || account.status !== "ACTIVE" || !account.emailVerifiedAt || account.passwordHash !== user.passwordHash) throw invalid();
    if (step !== null) {
      const changed = await tx.user.updateMany({ where: { id: user.id, mfaLastStep: { lt: BigInt(step) }, status: "ACTIVE" }, data: { mfaLastStep: BigInt(step) } });
      if (changed.count !== 1) throw invalid();
    }
    await tx.session.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt, mfaVerified: manager } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "LOGIN" } });
  });
  return { token, expiresAt };
}
export async function getSession(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await db.session.findUnique({ where: { tokenHash: digest(token) }, include: {
    user: { select: { ...publicUser, memberships: { where: { school: { active: true } }, include: { school: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "asc" } } } },
  } });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) return null;
  return session;
}
export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export function requireManager(session: AuthSession, schoolId: string) {
  const membership = session.user.memberships.find(item => item.schoolId === schoolId);
  if (!session.mfaVerified || membership?.status !== "APPROVED" || membership.role !== "MANAGER") throw new AppError(403, "Você não tem permissão para gerenciar esta escola.");
  return membership;
}
export async function logout(token: string | undefined, all = false) {
  const session = await getSession(token);
  if (session) await db.$transaction([
    db.session.deleteMany({ where: all ? { userId: session.userId } : { id: session.id } }),
    db.auditEvent.create({ data: { actorId: session.userId, action: all ? "SESSIONS_REVOKED" : "LOGOUT" } }),
  ]);
}
