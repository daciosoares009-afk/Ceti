import nodemailer from "nodemailer";
import { env } from "../security/config";
export async function sendActionEmail(email: string, token: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD") {
  const config = env();
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE === "true",
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const verification = purpose === "VERIFY_EMAIL";
  // Fragment stays out of HTTP access logs and Referrer headers. Consumed only by a POST.
  const link = `${new URL(config.APP_URL).origin}/${verification ? "confirmar-email" : "redefinir-senha"}#token=${token}`;
  const message = { from: config.SMTP_FROM, to: email,
    subject: verification ? "Confirme seu e-mail — CETI" : "Redefina sua senha — CETI",
    text: `${verification ? "Confirme seu e-mail para solicitar acesso à escola" : "Redefina sua senha"}:\n\n${link}\n\nO link expira em ${verification ? "24 horas" : "30 minutos"} e só pode ser usado uma vez. Se não solicitou esta ação, ignore este e-mail.`,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      transport.sendMail(message),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { transport.close(); reject(new Error("SMTP deadline exceeded")); }, 45000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); transport.close(); }
}
