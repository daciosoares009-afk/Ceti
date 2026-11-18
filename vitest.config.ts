import { defineConfig } from "vitest/config";
import "dotenv/config";
export default defineConfig({ test: {
  projects: [
    { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
    { test: { name: "integration", include: ["tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 30000, hookTimeout: 30000 } },
  ],
} });
