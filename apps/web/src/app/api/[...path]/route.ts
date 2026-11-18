import { NextRequest } from "next/server";
import { z } from "zod";
import { register, login, requestEmail, consumeToken, logout } from "../../../modules/identity/service";
import { registrationSchema, loginSchema, requestEmailSchema, consumeSchema, resetSchema, reviewSchema, joinSchema } from "../../../modules/identity/validation";
import { assertSameOrigin, readBody, clientIp, authenticated, sessionCookie, json, apiError } from "../../../modules/security/http";
import { rateLimit } from "../../../modules/security/rate-limit";
import { AppError } from "../../../modules/security/errors";
import { publicSchools, joinSchool, reviewMembership, managementData } from "../../../modules/schools/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const path = (await context.params).path.join("/");
    if (path === "schools") { await rateLimit("schools-ip", clientIp(request), 60, 60); return json({ schools: await publicSchools() }); }
    const session = await authenticated(request);
    await rateLimit("read-user", session.userId, 120, 60);
    if (path === "me") return json({ user: session.user, mfaVerified: session.mfaVerified });
    if (path === "management") {
      const schoolId = z.uuid().safeParse(request.nextUrl.searchParams.get("schoolId"));
      if (!schoolId.success) throw new AppError(400, "Escola inválida.");
      return json(await managementData(session, schoolId.data));
    }
    throw new AppError(404, "Recurso não encontrado.");
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const path = (await context.params).path.join("/");
    const ip = clientIp(request);
    await rateLimit("mutation-ip", ip, 120, 60);
    if (path === "auth/register") {
      await rateLimit("register-ip", ip, 10, 900);
      const input = await readBody(request, registrationSchema);
      await rateLimit("email-action", input.email, 5, 900);
      return json({ message: await register(input) }, 202);
    }
    if (path === "auth/login") {
      await rateLimit("login-ip", ip, 50, 900);
      const input = await readBody(request, loginSchema);
      await rateLimit("login-account", input.email, 10, 900);
      const result = await login(input);
      const response = json({ message: "Acesso autorizado." });
      response.cookies.set(sessionCookie(), result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: result.expiresAt });
      return response;
    }
    if (path === "auth/resend" || path === "auth/forgot") {
      await rateLimit("email-ip", ip, 10, 900);
      const input = await readBody(request, requestEmailSchema);
      await rateLimit("email-action", input.email, 5, 900);
      return json({ message: await requestEmail(input.email, path === "auth/resend" ? "VERIFY_EMAIL" : "RESET_PASSWORD") }, 202);
    }
    if (path === "auth/verify") {
      await rateLimit("token-ip", ip, 20, 900);
      const input = await readBody(request, consumeSchema);
      await consumeToken(input.token, "VERIFY_EMAIL");
      return json({ message: "E-mail confirmado. Sua solicitação está aguardando a análise da escola." });
    }
    if (path === "auth/reset") {
      await rateLimit("token-ip", ip, 20, 900);
      const input = await readBody(request, resetSchema);
      await consumeToken(input.token, "RESET_PASSWORD", input.password);
      return json({ message: "Senha atualizada. Entre novamente com sua nova senha." });
    }
    const session = await authenticated(request);
    await rateLimit("mutation-user", session.userId, 60, 60);
    if (path === "auth/logout" || path === "auth/revoke-sessions") {
      await readBody(request, z.object({}).strict());
      await logout(request.cookies.get(sessionCookie())?.value, path.endsWith("revoke-sessions"));
      const response = json({ message: "Sessão encerrada." });
      response.cookies.set(sessionCookie(), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }
    if (path === "memberships/join") {
      await joinSchool(session, await readBody(request, joinSchema));
      return json({ message: "Solicitação registrada. Acompanhe o estado no seu painel." });
    }
    if (path === "management/review") {
      await reviewMembership(session, await readBody(request, reviewSchema));
      return json({ message: "Vínculo atualizado." });
    }
    throw new AppError(404, "Recurso não encontrado.");
  } catch (error) { return apiError(error); }
}
