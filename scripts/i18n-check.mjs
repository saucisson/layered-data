#!/usr/bin/env node
// Static i18n check: fails on missing translations (empty value in a
// non-default locale) or dead keys (present in a catalog but no longer
// referenced in the sources). Run after i18next-parser extraction.
//
//   node scripts/i18n-check.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const LOCALES_DIR = "public/locales";
const DEFAULT_LOCALE = "en";
const SOURCES = ["src", "formalisms"];

const failures = [];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectSourceKeys() {
  const keys = new Set();
  const messagePattern = /message\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  const tPattern = /\bt\(\s*["'`]((?:[^"'`\\]|\\.)*)["'`]/g;
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|ld)$/.test(entry)) continue;
      const content = readFileSync(full, "utf8");
      for (const pattern of [messagePattern, tPattern]) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1].length > 0) keys.add(match[1]);
        }
      }
    }
  };
  for (const source of SOURCES) walk(source);
  return keys;
}

const sourceKeys = collectSourceKeys();
const locales = readdirSync(LOCALES_DIR).filter((entry) =>
  statSync(join(LOCALES_DIR, entry)).isDirectory()
);

for (const locale of locales) {
  const catalogPath = join(LOCALES_DIR, locale, "translation.json");
  const catalog = readJson(catalogPath);
  for (const [key, value] of Object.entries(catalog)) {
    if (locale !== DEFAULT_LOCALE && (value === "" || value === key && locale !== DEFAULT_LOCALE && !sourceKeys.has(key))) {
      // Empty translation in a non-default locale = missing.
      if (value === "") failures.push(`missing [${locale}]: ${key}`);
    }
    if (!sourceKeys.has(key)) {
      failures.push(`dead key [${locale}]: ${key}`);
    }
  }
}

// Keys used in sources but absent from the default catalog.
const defaultCatalog = readJson(join(LOCALES_DIR, DEFAULT_LOCALE, "translation.json"));
for (const key of sourceKeys) {
  if (!(key in defaultCatalog)) failures.push(`untranslated key [${DEFAULT_LOCALE}]: ${key}`);
}

if (failures.length > 0) {
  console.error(`i18n check failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`i18n check passed: ${sourceKeys.size} keys, ${locales.length} locales, 0 missing, 0 dead.`);
