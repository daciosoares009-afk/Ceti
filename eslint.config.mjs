import next from "eslint-config-next/core-web-vitals";
import ts from "typescript-eslint";
const config = [
  { ignores: ["**/node_modules/**", "**/.next/**", "playwright-report/**", "test-results/**", "**/next-env.d.ts"] },
  ...next,
  ...ts.configs.recommended,
  { settings: { next: { rootDir: "apps/web/" } } },
];
export default config;
