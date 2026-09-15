import { defineConfig } from "vitest/config";

/**
 * The app's components are React Server Components and rely on the automatic
 * JSX runtime (no `React` import in scope). Vitest's default esbuild transform
 * uses the classic runtime, which would require every tested component to
 * import React — so the runtime is set explicitly here.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
});
