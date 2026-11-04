#!/usr/bin/env node
// A minimal structural check for .tsx files where no JSX-capable
// compiler is available: balanced brackets outside strings and
// comments, and balanced JSX tags. Not a type checker — a cheap
// net against broken hand-written JSX.
//
// Assumptions that hold for this codebase: JS strings use double
// quotes only (French apostrophes live in JSX prose and
// comments), and TS generics always directly follow an identifier
// (`useState<X>`) while JSX tags never do.

import fs from "fs";

const files = process.argv.slice(2);
let failures = 0;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const problems = [];
  const lineOf = (position) => source.slice(0, position).split("\n").length;

  // ---- pass 1: mask strings (double quotes, templates) and comments ----
  let masked = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      masked += '"';
      index++;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\") {
          masked += "  ";
          index += 2;
          continue;
        }
        masked += source[index] === "\n" ? "\n" : " ";
        index++;
      }
      if (index >= source.length) {
        problems.push(`line ${lineOf(index)}: unterminated string`);
        break;
      }
      masked += '"';
      index++;
      continue;
    }
    // a single quote opens a string only in code context — French
    // prose apostrophes (`l'atelier`) always follow a letter
    if (character === "'") {
      const previous = masked.trimEnd().slice(-1);
      if (previous === "" || /[A-Za-z]/.test(previous)) {
        masked += character;
        index++;
        continue;
      }
      masked += "'";
      index++;
      while (index < source.length && source[index] !== "'") {
        if (source[index] === "\\") {
          masked += "  ";
          index += 2;
          continue;
        }
        masked += source[index] === "\n" ? "\n" : " ";
        index++;
      }
      if (index >= source.length) {
        problems.push(`line ${lineOf(index)}: unterminated string`);
        break;
      }
      masked += "'";
      index++;
      continue;
    }
    if (character === "`") {
      masked += "`";
      index++;
      while (index < source.length && source[index] !== "`") {
        masked += source[index] === "\n" ? "\n" : " ";
        index++;
      }
      masked += "`";
      index++;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        masked += source[index] === "\t" ? "\t" : " ";
        index++;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      masked += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        masked += source[index] === "\n" ? "\n" : " ";
        index++;
      }
      masked += "  ";
      index += 2;
      continue;
    }
    masked += character;
    index++;
  }

  // ---- pass 2: bracket balance on the masked text ----
  const pairs = { "{": "}", "(": ")", "[": "]" };
  const openStack = [];
  for (let position = 0; position < masked.length; position++) {
    const character = masked[position];
    if (pairs[character]) openStack.push({ character, line: lineOf(position) });
    else if (character === "}" || character === ")" || character === "]") {
      const top = openStack.pop();
      if (!top || pairs[top.character] !== character) {
        problems.push(`line ${lineOf(position)}: unexpected ${character}`);
      }
    }
  }
  for (const unclosed of openStack) {
    problems.push(`line ${unclosed.line}: unclosed ${unclosed.character}`);
  }

  // ---- pass 3: JSX tag balance on the masked text ----
  // A manual scanner: a `<` that follows an identifier is a TS
  // generic, never a tag. Inside a tag, braces nest freely and the
  // scan for the closing `>` runs at brace depth 0.
  const tagStack = [];
  let position = 0;
  while (position < masked.length) {
    if (masked[position] !== "<") {
      position++;
      continue;
    }
    const before = masked[position - 1] ?? "";
    const tagMatch = /^<(\/?)([A-Za-z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)/.exec(masked.slice(position));
    if (!tagMatch) {
      position++;
      continue;
    }
    // an opening `<` that directly follows an identifier is a TS
    // generic, never a tag; a closing `</tag>` can touch preceding
    // prose (`refines</span>`) and is always a real tag
    if (tagMatch[1] !== "/" && /[A-Za-z0-9_]/.test(before)) {
      position++;
      continue;
    }
    const closing = tagMatch[1] === "/";
    const name = tagMatch[2];
    let cursor = position + tagMatch[0].length;
    let depth = 0;
    let closed = false;
    while (cursor < masked.length) {
      const character = masked[cursor];
      if (character === "{") depth++;
      else if (character === "}") depth = Math.max(0, depth - 1);
      else if (character === ">" && depth === 0) {
        closed = true;
        break;
      }
      cursor++;
    }
    if (!closed) {
      problems.push(`line ${lineOf(position)}: <${name}> has no closing angle bracket`);
      break;
    }
    // self-closing? the character directly before the closing `>` is `/`
    const selfClosing = masked[cursor - 1] === "/";
    if (closing && selfClosing) {
      problems.push(`line ${lineOf(position)}: </${name}/> closes and self-closes`);
    } else if (closing) {
      const top = tagStack.pop();
      if (!top || top.name !== name) {
        problems.push(`line ${lineOf(position)}: </${name}> does not match <${top ? top.name : "nothing"}>`);
        for (let depthInStack = tagStack.length - 1; depthInStack >= 0; depthInStack--) {
          if (tagStack[depthInStack].name === name) {
            tagStack.splice(depthInStack);
            break;
          }
        }
      }
    } else if (!selfClosing) {
      tagStack.push({ name, line: lineOf(position) });
    }
    position = cursor + 1;
  }
  for (const unclosed of tagStack) {
    problems.push(`line ${unclosed.line}: <${unclosed.name}> never closed`);
  }

  if (problems.length > 0) {
    failures++;
    console.log(`FAIL ${file}`);
    for (const problem of problems.slice(0, 20)) console.log(`   ${problem}`);
  } else {
    console.log(`ok   ${file}`);
  }
}
process.exit(failures > 0 ? 1 : 0);
