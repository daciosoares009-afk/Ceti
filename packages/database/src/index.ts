import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export function createDatabaseClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("Configure DATABASE_URL.");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL.");
  url.searchParams.set("options", "-c timezone=UTC -c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000");
  // adapter-pg serializes Date values without an offset. Every connection must interpret them as UTC.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 10, connectionTimeoutMillis: 5000 }), log: [] });
}
const globalDb = globalThis as unknown as { cetiDb?: PrismaClient };
export const db = globalDb.cetiDb ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalDb.cetiDb = db;
