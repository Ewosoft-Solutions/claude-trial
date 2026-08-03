import tseslint from "typescript-eslint";

/**
 * Shared "defend the render against absent data" lint rules — the mechanical
 * half of AGENTS.md Golden rule #9. These are TYPE-AWARE, so they only apply to
 * TS/TSX and require the TypeScript project service (`projectService: true`).
 *
 * Scoped to the frontend surfaces (apps/web via next-js, packages/ui via
 * react-internal) where an unguarded dereference of possibly-absent data
 * white-screens a route. The backend is excluded on purpose: a NestJS handler
 * that throws is caught by the exception filter, a very different blast radius.
 *
 * Note the type-level half of the rule (`noUncheckedIndexedAccess` + `strict`)
 * is already enforced repo-wide by packages/typescript-config/base.json.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const defensiveAccessConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true },
    },
    rules: {
      // Prefer `a?.b` over `a && a.b` — the optional-chaining idiom. Safely
      // auto-fixable, so `eslint --fix` migrates existing chains.
      "@typescript-eslint/prefer-optional-chain": "warn",
      // Catch the real bug this whole rule exists for: a nullable OBJECT/ARRAY
      // guarded with `||` (`rows || []`, `summary || {}`), where a semantically
      // valid value would be silently swallowed — steer those to `??`. The opts
      // deliberately exclude the cases where `||` is correct and `??` would be a
      // regression, so this stays signal, not noise:
      //   - ignorePrimitives: boolean/number/string/bigint logical-OR is
      //     intentional combining logic (`disabled || busy`), never a fallback.
      //   - ignoreBooleanCoercion: `Boolean(a || b)` is a truthiness test.
      //   - ignoreIfStatements: `if (!x) x = y` is a style choice, not a bug.
      // Not auto-fixed (the swap can change behaviour) — ships as a suggestion.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "warn",
        {
          ignorePrimitives: true,
          ignoreBooleanCoercion: true,
          ignoreIfStatements: true,
        },
      ],
    },
  },
];
