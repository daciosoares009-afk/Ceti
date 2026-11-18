import { db } from "@ceti/database";
import { decryptSecret, digest } from "../security/crypto";
import { env } from "../security/config";
import { sendActionEmail } from "./mail";
export async function deliverEmailBatch() {
  // Lease jobs atomically; multiple workers can run without sending the same active lease.
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "EmailJob" SET "claimedAt" = NOW(), "attempts" = "attempts" + 1
    WHERE "id" IN (SELECT "id" FROM "EmailJob" WHERE "availableAt" <= NOW() AND "attempts" < 5
      AND ("claimedAt" IS NULL OR "claimedAt" < NOW() - INTERVAL '2 minutes')
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 10)
    RETURNING "id"`;
  let delivered = 0, failed = 0;
  await Promise.all(claimed.map(async row => {
    const job = await db.emailJob.findUnique({ where: { id: row.id }, include: { token: { include: { user: { select: { email: true, status: true } } } } } });
    if (!job) return;
    if (job.token.expiresAt <= new Date() || job.token.user.status !== "ACTIVE") { await db.emailJob.deleteMany({ where: { id: job.id } }); return; }
    try {
      const token = decryptSecret(job.tokenCiphertext, digest(`${env().MFA_ENCRYPTION_KEY}:email-outbox-v1`));
      await sendActionEmail(job.token.user.email, token, job.token.purpose);
      await db.emailJob.deleteMany({ where: { id: job.id } }); delivered++;
    } catch {
      failed++;
      await db.emailJob.updateMany({ where: { id: job.id }, data: { claimedAt: null, availableAt: new Date(Date.now() + Math.min(60 * 2 ** job.attempts, 3600) * 1000) } });
    }
  }));
  if (failed) console.error(JSON.stringify({ event: "email_delivery_failed", count: failed }));
  return { delivered, failed };
}
