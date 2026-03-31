import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.{test,spec}.ts"],
    exclude: [
      ".nuxt/**",
      ".output/**",
      "dist/**",
      "node_modules/**",
      "operations-api/**",
    ],
    environment: "node",
    passWithNoTests: true,
    reporters: ["default"],
  },
});
