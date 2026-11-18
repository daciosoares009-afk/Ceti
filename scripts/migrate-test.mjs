import "dotenv/config";
import { spawnSync } from "node:child_process";
const value = process.env.TEST_DATABASE_URL;
if (!value) throw new Error("TEST_DATABASE_URL is required");
const url = new URL(value);
if (!url.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Use a dedicated local *_test database");
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "packages/database/prisma/schema.prisma"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: value } });
process.exit(result.status ?? 1);
