// Custom i18next-parser lexer for .ld formalism files.
// Extracts the English string of every `message = "..."` line:
// the string is both the translation key and the default English value.
import { EventEmitter } from "node:events";

export default class LdLexer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
  }

  extract(content, _filename) {
    const keys = [];
    const pattern = /message\s*=\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      keys.push({ key: match[1], defaultValue: match[1] });
    }
    return keys;
  }
}
