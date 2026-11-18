import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "./config";
import { AppError } from "./errors";
import { getSession } from "../identity/service";
export const sessionCookie = () => process.env.NODE_ENV === "production" ? "__Host-ceti-session" : "ceti-session";
export function clientIp(request: NextRequest) {
  // Direct mode deliberately shares one IP bucket. Never trust client-provided forwarding by default.
  if (env().TRUST_PROXY !== "true") return "direct";
  const value = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return value && /^[a-f0-9:.]{3,45}$/i.test(value) ? value : "unknown";
}
export function assertSameOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(env().APP_URL).origin) throw new AppError(403, "Origem da solicitação inválida.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "Solicitação não permitida.");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new AppError(415, "Envie dados em formato JSON.");
}
export async function readBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Dados ausentes.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); throw new AppError(413, "Solicitação muito grande."); }
    chunks.push(value);
  }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError(400, "Dados JSON inválidos."); }
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? "Confira os dados informados.");
  return result.data;
}
export async function authenticated(request: NextRequest) {
  const session = await getSession(request.cookies.get(sessionCookie())?.value);
  if (!session) throw new AppError(401, "Entre novamente para continuar.");
  return session;
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
}
export function apiError(error: unknown) {
  if (error instanceof AppError) {
    const response = json({ message: error.message }, error.status);
    if (error.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
  console.error(JSON.stringify({ event: "request_failed", category: error instanceof z.ZodError ? "configuration" : "internal" }));
  return json({ message: "Não foi possível concluir agora. Tente novamente em instantes." }, 503);
}
