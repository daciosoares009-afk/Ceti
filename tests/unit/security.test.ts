import { describe, expect, it } from "vitest";
import { digest, newToken, passwordHash, passwordMatches, encryptSecret, decryptSecret, totpCode, verifyTotp } from "../../apps/web/src/modules/security/crypto";
import { registrationSchema, reviewSchema, resetSchema } from "../../apps/web/src/modules/identity/validation";
import { requireManager, type AuthSession } from "../../apps/web/src/modules/identity/service";
describe("tokens e credenciais", () => {
  it("produz tokens aleatórios e armazena somente hash determinístico", () => {
    const first = newToken(); expect(first).toHaveLength(43); expect(first).not.toEqual(newToken());
    expect(digest(first)).toHaveLength(64); expect(digest(first)).not.toContain(first); expect(digest(first)).toEqual(digest(first));
  });
  it("usa Argon2id e rejeita senha incorreta", async () => {
    const encoded = await passwordHash("uma-senha-exclusiva-123"); expect(encoded).toContain("$argon2id$");
    expect(await passwordMatches(encoded, "uma-senha-exclusiva-123")).toBe(true);
    expect(await passwordMatches(encoded, "outra-senha")).toBe(false);
  });
  it("cifra MFA e detecta adulteração", () => {
    const key = "a".repeat(64); const encrypted = encryptSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", key);
    expect(decryptSecret(encrypted, key)).toBe("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(encrypted, "b".repeat(64))).toThrow();
  });
  it("confere vetor RFC 6238, expiração e replay de MFA", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // gitleaks:allow -- public RFC 6238 test vector, never a real credential
    expect(totpCode(secret, 1)).toBe("287082");
    expect(verifyTotp(secret, "287082", -1n, 59000)).toBe(1);
    expect(verifyTotp(secret, "287082", 1n, 59000)).toBeNull();
    expect(verifyTotp(secret, "287082", -1n, 180000)).toBeNull();
    expect(verifyTotp(secret, "invalid", -1n)).toBeNull();
  });
});
describe("validação e autorização", () => {
  const registration = { name: "Pessoa de teste", email: "Aluno@EXAMPLE.com", password: "uma-senha-exclusiva", schoolId: "5be82b34-8911-4f3d-9b2e-b0114f4de79a", role: "STUDENT" };
  it("normaliza e-mail e proíbe cadastro de gestor e mass assignment", () => {
    expect(registrationSchema.parse(registration).email).toBe("aluno@example.com");
    expect(registrationSchema.safeParse({ ...registration, role: "MANAGER" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...registration, status: "APPROVED" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...registration, password: "curta" }).success).toBe(false);
  });
  it("rejeita identificadores malformados e tokens arbitrários", () => {
    expect(reviewSchema.safeParse({ schoolId: "' OR 1=1", membershipId: registration.schoolId, decision: "APPROVED" }).success).toBe(false);
    expect(resetSchema.safeParse({ token: "guess", password: registration.password }).success).toBe(false);
  });
  it("exige gestor aprovado, MFA e vínculo com a escola correta", () => {
    const session = { mfaVerified: true, user: { memberships: [{ schoolId: "school-a", role: "MANAGER", status: "APPROVED" }] } } as AuthSession;
    expect(() => requireManager(session, "school-a")).not.toThrow();
    expect(() => requireManager(session, "school-b")).toThrow();
    expect(() => requireManager({ ...session, mfaVerified: false }, "school-a")).toThrow();
    expect(() => requireManager({ ...session, user: { ...session.user, memberships: [{ ...session.user.memberships[0], status: "SUSPENDED" }] } }, "school-a")).toThrow();
  });
});
