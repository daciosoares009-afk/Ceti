import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const directory = process.argv[2];
if (!directory) throw new Error("SARIF directory is required");
const files = readdirSync(directory).filter(file => file.endsWith(".sarif"));
if (!files.length) throw new Error("No SARIF files produced; refusing a silent pass");
let high = 0;
for (const file of files) {
  const document = JSON.parse(readFileSync(join(directory, file), "utf8"));
  for (const run of document.runs ?? []) {
    const rules = new Map((run.tool?.driver?.rules ?? []).map(rule => [rule.id, rule]));
    for (const result of run.results ?? []) {
      const severity = Number(rules.get(result.ruleId)?.properties?.["security-severity"] ?? 0);
      if (severity >= 7 || result.level === "error") high++;
    }
  }
}
console.log(JSON.stringify({ event: "sarif_gate", highOrCritical: high }));
if (high) process.exitCode = 1;
