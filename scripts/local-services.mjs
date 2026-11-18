import EmbeddedPostgres from "embedded-postgres";
import { SMTPServer } from "smtp-server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
const local = resolve(".local");
mkdirSync(local, { recursive: true });
if (!existsSync(".env")) {
  const password = randomBytes(24).toString("hex");
  const example = readFileSync(".env.example", "utf8");
  writeFileSync(".env", example.replaceAll("local-development-only", password).replaceAll(":5432/", ":55432/").replace("MFA_ENCRYPTION_KEY=", `MFA_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`), { mode: 0o600 });
}
config({ quiet: true });
const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/ceti" || process.env.SMTP_HOST !== "127.0.0.1") throw new Error("Local services require a loopback development configuration.");
const pg = new EmbeddedPostgres({ databaseDir: resolve(local, "postgres"), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), port: Number(url.port), persistent: true, authMethod: "scram-sha-256", postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
if (!existsSync(resolve(local, "postgres", "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
for (const name of ["ceti", "ceti_test"]) {
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!rows.length) await pg.createDatabase(name);
}
await client.end();
mkdirSync(resolve(local, "mailbox"), { recursive: true });
const smtp = new SMTPServer({ authOptional: true, disabledCommands: ["AUTH", "STARTTLS"], size: 65536, logger: false,
  onData(stream, session, callback) {
    const chunks = []; stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => {
      if (stream.sizeExceeded) { callback(new Error("Message too large")); return; }
      writeFileSync(resolve(local, "mailbox", `${Date.now()}-${randomUUID()}.eml`), Buffer.concat(chunks), { mode: 0o600 });
      console.log("E-mail de desenvolvimento salvo na caixa local (.local/mailbox). Conteúdo omitido.");
      callback();
    });
    stream.on("error", callback);
  },
});
await new Promise((resolve, reject) => { smtp.once("error", reject); smtp.listen(Number(process.env.SMTP_PORT), "127.0.0.1", resolve); });
console.log(`Serviços locais prontos: PostgreSQL em 127.0.0.1:${url.port}; SMTP em 127.0.0.1:${process.env.SMTP_PORT}. Dados persistentes em .local/. Nenhuma escola ou conta de exemplo foi criada.`);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; smtp.close(); await pg.stop(); process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
