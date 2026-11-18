import { z } from "zod";
export const emailSchema = z.email().max(254).transform(value => value.trim().toLowerCase());
export const passwordSchema = z.string().min(12, "Use pelo menos 12 caracteres.").max(128, "Use no máximo 128 caracteres.");
export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema,
  schoolId: z.uuid(), role: z.enum(["STUDENT", "TEACHER"]),
}).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/).or(z.literal("")).optional() }).strict();
export const requestEmailSchema = z.object({ email: emailSchema }).strict();
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const consumeSchema = z.object({ token: tokenSchema }).strict();
export const resetSchema = z.object({ token: tokenSchema, password: passwordSchema }).strict();
export const reviewSchema = z.object({ schoolId: z.uuid(), membershipId: z.uuid(), decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]) }).strict();
export const joinSchema = z.object({ schoolId: z.uuid(), role: z.enum(["STUDENT", "TEACHER"]) }).strict();
