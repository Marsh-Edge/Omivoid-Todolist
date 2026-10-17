import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / packaged output:
    "electron/out/**",
    "release/**",
    // esbuild bundle of the 10k perf-seed script (source: scripts/seed-10k.ts):
    "scripts/*.cjs",
  ]),
]);

export default eslintConfig;
