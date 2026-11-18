import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
const ignored = new Set(["node_modules", ".git", ".next", ".local", ".codex", ".agents", "coverage", "test-results", "playwright-report"]);
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["aws-access-key", /\bAKIA[A-Z0-9]{16}\b/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["openai-token", /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ["unsafe-prisma", /\.(?:\$queryRawUnsafe|\$executeRawUnsafe)\s*\(/],
  ["unsafe-html", /dangerouslySetInnerHTML\s*=/],
];
const findings = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || (entry.name.startsWith(".env") && entry.name !== ".env.example")) continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { walk(path); continue; }
    if (!/\.(?:tsx?|m?js|json|ya?ml|md|sql|prisma)$/.test(entry.name)) continue;
    const content = readFileSync(path, "utf8");
    for (const [name, pattern] of rules) if (pattern.test(content)) findings.push({ file: relative(process.cwd(), path), rule: name });
  }
}
walk(process.cwd());
// Output file and rule only, never the matched secret.
if (findings.length) { console.error(JSON.stringify({ findings }, null, 2)); process.exitCode = 1; }
else console.log("Verificação local de segredos e padrões perigosos: nenhuma ocorrência nas regras configuradas.");
