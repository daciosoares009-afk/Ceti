import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
for (const file of ["package.json", "apps/web/package.json", "packages/database/package.json"]) {
  const absolute = resolve(file); const require = createRequire(absolute);
  const json = JSON.parse(readFileSync(absolute, "utf8"));
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, version] of Object.entries(json[section] ?? {})) {
      if (version.startsWith("workspace:")) continue;
      let manifest;
      try { manifest = require.resolve(`${name}/package.json`); }
      catch {
        let path = dirname(require.resolve(name));
        while (dirname(path) !== path) { const candidate = join(path, "package.json"); if (existsSync(candidate) && JSON.parse(readFileSync(candidate, "utf8")).name === name) { manifest = candidate; break; } path = dirname(path); }
      }
      if (!manifest) throw new Error(`Cannot resolve ${name}`);
      json[section][name] = JSON.parse(readFileSync(manifest, "utf8")).version;
    }
  }
  writeFileSync(absolute, `${JSON.stringify(json, null, 2)}\n`);
}
console.log("Dependências diretas fixadas nas versões instaladas. Reconcile o lockfile antes de validar.");
