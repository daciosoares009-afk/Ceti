import { db } from "@ceti/database";
import { digest } from "./crypto";
import { AppError } from "./errors";
export async function rateLimit(scope: string, identifier: string, limit: number, seconds: number) {
  const key = digest(`${scope}:${identifier}`);
  // Atomic UPSERT: shared by every application instance, no in-memory bypass.
  const rows = await db.$queryRaw<{ hits: number }[]>`
    INSERT INTO "RateLimit" ("key", "hits", "expiresAt") VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN 1 ELSE "RateLimit"."hits" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= NOW() THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "RateLimit"."expiresAt" END
    RETURNING "hits"`;
  if (rows[0].hits > limit) throw new AppError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
}
