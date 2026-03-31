import js from "@eslint/js";

export default [
  {
    ignores: [
      ".nuxt/**",
      ".output/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "operations-api/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
];
