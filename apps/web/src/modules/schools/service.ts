import { db } from "@ceti/database";
import { z } from "zod";
import { AuthSession, requireManager } from "../identity/service";
import { reviewSchema, joinSchema } from "../identity/validation";
import { AppError } from "../security/errors";
export async function publicSchools() {
  return db.school.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 });
}
export async function joinSchool(session: AuthSession, input: z.infer<typeof joinSchema>) {
  const school = await db.school.findFirst({ where: { id: input.schoolId, active: true }, select: { id: true } });
  if (!school) throw new AppError(400, "Escola indisponível.");
  await db.membership.upsert({ where: { userId_schoolId: { userId: session.userId, schoolId: input.schoolId } },
    create: { userId: session.userId, schoolId: input.schoolId, role: input.role, status: "PENDING_REVIEW" }, update: {},
  });
}
export async function reviewMembership(session: AuthSession, input: z.infer<typeof reviewSchema>) {
  requireManager(session, input.schoolId);
  await db.$transaction(async tx => {
    // Lock manager and target memberships in a stable order; prevent revocation races.
    const rows = await tx.$queryRaw<{ id: string; userId: string; role: string; status: string }[]>`
      SELECT m."id", m."userId", m."role", m."status" FROM "Membership" m
      JOIN "School" s ON s."id" = m."schoolId"
      WHERE m."schoolId" = ${input.schoolId}::uuid AND s."active" = true
        AND (m."userId" = ${session.userId}::uuid OR m."id" = ${input.membershipId}::uuid)
      ORDER BY m."id" FOR UPDATE OF m`;
    const manager = rows.find(row => row.userId === session.userId);
    const target = rows.find(row => row.id === input.membershipId);
    if (manager?.role !== "MANAGER" || manager.status !== "APPROVED") throw new AppError(403, "Permissão revogada.");
    if (!target || target.role === "MANAGER" || target.userId === session.userId) throw new AppError(404, "Solicitação não encontrada.");
    const allowed = input.decision === "SUSPENDED" ? target.status === "APPROVED" : target.status === "PENDING_REVIEW";
    if (!allowed) throw new AppError(409, "Esta solicitação já mudou. Atualize a página.");
    const user = await tx.user.findFirst({ where: { id: target.userId, status: "ACTIVE", emailVerifiedAt: { not: null } }, select: { id: true } });
    if (!user) throw new AppError(409, "A conta ainda não está apta para aprovação.");
    await tx.membership.update({ where: { id: target.id }, data: { status: input.decision, reviewedAt: new Date(), reviewedBy: session.userId } });
    await tx.auditEvent.create({ data: { schoolId: input.schoolId, actorId: session.userId, targetId: target.id, action: `MEMBERSHIP_${input.decision}` } });
  });
}
export async function managementData(session: AuthSession, schoolId: string) {
  requireManager(session, schoolId);
  const [pending, active, counts, events] = await Promise.all([
    db.membership.findMany({ where: { schoolId, status: "PENDING_REVIEW", role: { not: "MANAGER" } }, select: { id: true, role: true, createdAt: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" }, take: 50 }),
    db.membership.findMany({ where: { schoolId, status: "APPROVED", role: { not: "MANAGER" } }, select: { id: true, role: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.membership.groupBy({ by: ["role", "status"], where: { schoolId }, _count: true }),
    db.auditEvent.findMany({ where: { schoolId }, select: { id: true, action: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  await db.auditEvent.create({ data: { schoolId, actorId: session.userId, action: "MEMBERSHIPS_VIEWED" } });
  return { pending, active, counts, events };
}
