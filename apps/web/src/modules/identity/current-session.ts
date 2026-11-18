import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSession } from "./service";
import { sessionCookie } from "../security/http";
export const currentSession = cache(async () => {
  const session = await getSession((await cookies()).get(sessionCookie())?.value);
  if (!session) redirect("/entrar");
  return session;
});
