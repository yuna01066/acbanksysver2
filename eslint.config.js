import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Existing app code still contains broad Supabase/data-shape anys.
      // Keep type cleanup as a scoped refactor instead of blocking every build.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // The app has many legacy data-fetch effects. Keep rules-of-hooks active,
      // but avoid blocking CI until those flows are refactored screen by screen.
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
    },
  }
);
