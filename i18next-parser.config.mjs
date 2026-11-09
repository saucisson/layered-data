// i18next-parser configuration: static extraction of translation keys.
//
// Two sources are scanned:
//   - TypeScript sources: t("key") calls (default JS/TS lexer)
//   - .ld formalism files: message = "..." lines (custom LdLexer)
//
// npm run i18n:check runs the parser and fails on missing or dead keys.

import LdLexer from "./scripts/ld-lexer.mjs";

export default {
  locales: ["en", "fr"],
  defaultNamespace: "translation",
  output: "public/locales/$LOCALE/$NAMESPACE.json",
  input: ["src/**/*.ts", "src/**/*.tsx", "formalisms/**/*.ld"],
  lexers: {
    ld: [{ lexer: LdLexer }],
  },
  keySeparator: false,
  namespaceSeparator: false,
  // The English string is the key: readable inline in .ld files.
  useKeysAsDefaultValue: ["en"],
  defaultValue: (locale, _namespace, key) => (locale === "en" ? key : ""),
  keepRemoved: false,
  sort: true,
};
