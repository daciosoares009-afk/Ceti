import { beforeAll, describe, expect, it } from "vitest";
import { assertSameOrigin, readBody } from "../../apps/web/src/modules/security/http";
import { registrationSchema } from "../../apps/web/src/modules/identity/validation";
beforeAll(() => { process.env.APP_URL = "http://localhost:3000"; process.env.MFA_ENCRYPTION_KEY = "a".repeat(64); process.env.SMTP_HOST = "localhost"; process.env.SMTP_PORT = "1025"; process.env.SMTP_FROM = "test@localhost"; });
describe("fronteira HTTP", () => {
  function request(origin: string, body = "{}", type = "application/json") { return new Request("http://localhost:3000/api/auth/register", { method: "POST", headers: { Origin: origin, "Content-Type": type }, body }) as Parameters<typeof readBody>[0]; }
  it("bloqueia CSRF e formulários externos", () => {
    expect(() => assertSameOrigin(request("https://attacker.example"))).toThrow();
    expect(() => assertSameOrigin(request(""))).toThrow();
    expect(() => assertSameOrigin(request("http://localhost:3000", "{}", "text/plain"))).toThrow();
    expect(() => assertSameOrigin(request("http://localhost:3000"))).not.toThrow();
  });
  it("limita corpo e rejeita JSON inválido antes do serviço", async () => {
    await expect(readBody(request("http://localhost:3000", "x".repeat(17000)), registrationSchema)).rejects.toMatchObject({ status: 413 });
    await expect(readBody(request("http://localhost:3000", "bad"), registrationSchema)).rejects.toMatchObject({ status: 400 });
  });
});
