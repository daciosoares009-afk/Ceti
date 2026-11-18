import { createHash, randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const passwordHash = (value: string) => hash(value, { algorithm: 2 /* Argon2id */, memoryCost: 65536, timeCost: 3, parallelism: 1 });
export async function passwordMatches(encoded: string, value: string) {
  try { return await verify(encoded, value); } catch { return false; }
}
export function encryptSecret(secret: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptSecret(value: string, key: string) {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}
export function decodeBase32(value: string) {
  if (!/^[A-Z2-7]{32,64}$/.test(value)) throw new Error("Segredo TOTP inválido");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const letter of value) bits += alphabet.indexOf(letter).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2)));
}
export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const bytes = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = bytes[bytes.length - 1] & 15;
  return ((bytes.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
export function verifyTotp(secret: string, code: string, lastStep: bigint, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (BigInt(step) > lastStep && timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}
