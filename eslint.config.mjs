import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {ignores:["dist/**","node_modules/**","coverage/**",".next/**",".pages-functions/**"]},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files:["**/*.{ts,tsx}"],
    languageOptions:{parserOptions:{ecmaVersion:"latest",sourceType:"module",ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node}},
    plugins:{"react-hooks":reactHooks},
    rules:{
      ...reactHooks.configs.recommended.rules,
      "no-undef":"off",
      "no-unused-vars":"off",
      "no-useless-escape":"off",
    },
  },
];
