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
    "public/chat-popup-widget/dist/**",
    "services/transcribe/.venv/**",
    "services/transcribe/.models/**",
    "**/.test-artifacts/**",
    "**/.pytest_cache/**",
    "**/__pycache__/**",
  ]),
]);

export default eslintConfig;
