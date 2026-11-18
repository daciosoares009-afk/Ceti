import { z } from "zod";
const schema = z.object({
  APP_URL: z.url(),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i, "Configure MFA_ENCRYPTION_KEY com 32 bytes em hexadecimal."),
  SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_FROM: z.string().min(1), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export function env() {
  const value = schema.parse(process.env);
  const url = new URL(value.APP_URL);
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("APP_URL deve conter apenas a origem.");
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || value.SMTP_SECURE !== "true" || !value.SMTP_USER || !value.SMTP_PASSWORD)) {
    throw new Error("Produção exige HTTPS, SMTP TLS e credenciais de e-mail.");
  }
  return value;
}
