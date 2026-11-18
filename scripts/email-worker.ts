import "dotenv/config";
import { deliverEmailBatch } from "../apps/web/src/modules/identity/email-worker";
import { db } from "../packages/database/src/index";
import { env } from "../apps/web/src/modules/security/config";
env();
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
async function main() {
  while (!stopping) {
    try { await deliverEmailBatch(); }
    catch { console.error(JSON.stringify({ event: "email_worker_failed" })); }
    if (process.argv.includes("--once")) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
main().finally(() => db.$disconnect());
