import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const production = process.env.NODE_ENV === "production";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${production ? "" : " ws://localhost:* ws://127.0.0.1:*"}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';${production ? " upgrade-insecure-requests;" : ""}`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
