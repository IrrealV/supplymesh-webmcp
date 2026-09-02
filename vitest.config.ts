import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    mockReset: true,
    restoreMocks: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 20000,
  },
});
