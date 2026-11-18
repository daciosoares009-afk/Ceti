import "dotenv/config";
import { z } from "zod";
import { db } from "../packages/database/src/index";
import { passwordHash, encryptSecret, verifyTotp } from "../apps/web/src/modules/security/crypto";
import { env } from "../apps/web/src/modules/security/config";
import { enqueueActionEmail } from "../apps/web/src/modules/identity/service";
import { emailSchema, passwordSchema } from "../apps/web/src/modules/identity/validation";
// Provisioning is an operator-only stdin command; there is no public manager endpoint.
const schema = z.object({
  name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema,
  schoolName: z.string().trim().min(2).max(150), schoolSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  totpSecret: z.string().regex(/^[A-Z2-7]{32,64}$/), totpCode: z.string().regex(/^\d{6}$/),
}).strict();
async function main() {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of process.stdin) { size += chunk.length; if (size > 16384) throw new Error("Input too large"); chunks.push(Buffer.from(chunk)); }
  const input = schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  const config = env();
  const step = verifyTotp(input.totpSecret, input.totpCode, -1n);
  if (step === null) throw new Error("TOTP proof invalid");
  const encoded = await passwordHash(input.password);
  await db.$transaction(async tx => {
    const existing = await tx.school.findUnique({ where: { slug: input.schoolSlug } });
    if (existing && (!existing.active || existing.name !== input.schoolName)) throw new Error("School mismatch");
    const school = existing ?? await tx.school.create({ data: { name: input.schoolName, slug: input.schoolSlug } });
    const user = await tx.user.create({ data: {
      name: input.name, email: input.email, passwordHash: encoded,
      mfaSecret: encryptSecret(input.totpSecret, config.MFA_ENCRYPTION_KEY), mfaLastStep: BigInt(step),
      memberships: { create: { schoolId: school.id, role: "MANAGER", status: "APPROVED" } },
    }, select: { id: true } });
    await tx.auditEvent.create({ data: { schoolId: school.id, actorId: user.id, action: "MANAGER_BOOTSTRAPPED" } });
    await enqueueActionEmail(user.id, "VERIFY_EMAIL", tx);
  });
  console.log("Escola e gestor provisionados. Confirme o e-mail e use o próximo código do autenticador para entrar.");
}
main().catch(() => { console.error("Provisionamento não concluído. Confira configuração, dados únicos e código TOTP. Nenhum detalhe sensível foi registrado."); process.exitCode = 1; }).finally(() => db.$disconnect());
