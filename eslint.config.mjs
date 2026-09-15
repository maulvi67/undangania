import js from "@eslint/js";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "**/.turbo/**",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [
      "packages/**/*.{js,mjs,ts,tsx}",
      "services/**/*.{js,mjs,ts,tsx}",
      "tests/**/*.{js,mjs,ts,tsx}",
      "apps/backend-api/**/*.{js,mjs,ts,tsx}",
    ],
  })),
  {
    files: ["**/*.{js,mjs}"],
    ...js.configs.recommended,
  },
  ...coreWebVitals.map((config) => ({
    ...config,
    files: [
      "apps/customer-web/src/**/*.{ts,tsx}",
      "apps/admin-dashboard/src/**/*.{ts,tsx}",
    ],
  })),
  ...nextTypescript.map((config) => ({
    ...config,
    files: [
      "apps/customer-web/src/**/*.{ts,tsx}",
      "apps/admin-dashboard/src/**/*.{ts,tsx}",
    ],
  })),
];
