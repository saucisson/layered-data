// ESLint flat config — the mechanical half of the style contract
// (AGENTS.md / docs/architecture.md): layer boundaries, no console,
// named exports only, no default exports, no `any` (warn: the legacy
// kernel ports still carry some, tracked as debt).
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// The onion: src/domain <- src/application <- src/presentation <- src/App.tsx.
// Each zone may import the zones to its LEFT (inward), never its right.
const ZONES = [
  {
    zone: "src/domain",
    forbid: [
      "application",
      "presentation",
      "pages",
      "components",
      "infrastructure",
      "App.tsx",
      "WorkshopContainer.tsx",
    ],
  },
  { zone: "src/application", forbid: ["presentation", "pages", "components", "App.tsx", "WorkshopContainer.tsx"] },
  { zone: "src/presentation", forbid: ["App.tsx", "WorkshopContainer.tsx"] },
  { zone: "src/pages", forbid: ["App.tsx", "WorkshopContainer.tsx"] },
  { zone: "src/components", forbid: ["App.tsx", "WorkshopContainer.tsx"] },
];

/** One config block per zone: relative imports reaching outward are refused. */
const boundaryBlocks = ZONES.map(({ zone, forbid }) => ({
  files: [`${zone}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: forbid.flatMap((target) => [
          {
            group: [`../${target}`, `../${target}/**`, `../../${target}`, `../../${target}/**`],
            message: `${zone} must not import ${target} — the onion points inward (domain <- application <- presentation <- App).`,
          },
        ]),
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "coverage/", "*.config.js", "scripts/", "vscode/", "benchmarks/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "server/**/*.ts", "tests/**/*.mts"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ---- the house rules, mechanical ----
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Named exports only — no default exports.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // console is the harnesses' report channel in tests/; banned in src/ and server/
    files: ["src/**/*.{ts,tsx}", "server/**/*.ts"],
    rules: { "no-console": "error" },
  },
  ...boundaryBlocks,
);
