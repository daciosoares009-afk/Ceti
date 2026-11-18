import "dotenv/config";
import { db } from "../packages/database/src/index";
async function main() {
  const now = new Date();
  const [sessions, tokens, limits] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.actionToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  const failedEmailJobs = await db.emailJob.count({ where: { attempts: { gte: 5 } } });
  console.log(JSON.stringify({ event: "maintenance", sessions: sessions.count, tokens: tokens.count, limits: limits.count, failedEmailJobs }));
  if (failedEmailJobs) process.exitCode = 1;
}
main().catch(() => { console.error(JSON.stringify({ event: "maintenance_failed" })); process.exitCode = 1; }).finally(() => db.$disconnect());
