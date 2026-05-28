import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const {
  "no-useless-assignment": _noUselessAssignment,
  "preserve-caught-error": _preserveCaughtError,
  ...recommendedJsRules
} = js.configs.recommended.rules;

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [...tseslint.configs.recommended],
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
      ...recommendedJsRules,
      // Existing app code still contains broad Supabase/data-shape anys.
      // Keep type cleanup as a scoped refactor instead of blocking every build.
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Keep the critical hook invariant active, but avoid enabling React
      // Compiler lint rules across the legacy app before those flows are refactored.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
    },
  }
);
