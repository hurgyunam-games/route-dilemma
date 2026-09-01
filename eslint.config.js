import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["vite.config.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "vue", message: "src/core must not import Vue" },
            { name: "pinia", message: "src/core must not import Pinia" },
            { name: "pixi.js", message: "src/core must not import PixiJS" },
          ],
          patterns: [
            {
              group: ["vue/*", "@vue/*", "pinia/*", "pixi.js/*", "@pixi/*"],
              message: "src/core must stay headless",
            },
          ],
        },
      ],
    },
  },
);
