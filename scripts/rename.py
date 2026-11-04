#!/usr/bin/env python3
"""Identifier renamer for TS/TSX that never touches string literals,
template literals, or comments. JSX text is left alone by only
renaming whole-word identifiers that appear in the module's code."""
import re
import sys
import pathlib

def mask_strings_and_comments(source: str):
    """Return (masked_text, restore_map). Masked regions become
    \x00N\x00 placeholders so identifier regexes cannot match them."""
    out = []
    restores = []
    i = 0
    n = len(source)
    state = None  # None | "'" | '"' | '`' | '//' | '/*'
    while i < n:
        if state is None:
            c = source[i]
            nxt = source[i + 1] if i + 1 < n else ""
            if c == "/" and nxt == "/":
                state = "//"; out.append(c); i += 1; continue
            if c == "/" and nxt == "*":
                state = "/*"; out.append(c); i += 1; continue
            if c in ("'", '"', "`"):
                state = c; out.append(c); i += 1; continue
            out.append(c); i += 1; continue
        if state == "//":
            j = source.find("\n", i)
            if j == -1: j = n
            restores.append(source[i:j]); out.append("\x00%d\x00" % (len(restores) - 1)); i = j; state = None; continue
        if state == "/*":
            j = source.find("*/", i)
            j = j + 2 if j != -1 else n
            restores.append(source[i:j]); out.append("\x00%d\x00" % (len(restores) - 1)); i = j; state = None; continue
        # string states
        c = source[i]
        if c == "\\":
            restores.append(source[i:i + 2]); out.append("\x00%d\x00" % (len(restores) - 1)); i += 2; continue
        if c == state:
            restores.append(c); out.append("\x00%d\x00" % (len(restores) - 1)); i += 1; state = None; continue
        restores.append(c); out.append("\x00%d\x00" % (len(restores) - 1)); i += 1
    return "".join(out), restores

def restore(masked: str, restores):
    def sub(m):
        return restores[int(m.group(1))]
    return re.sub("\x00(\\d+)\x00", sub, masked)

def rename_identifiers(source: str, mapping: dict):
    masked, restores = mask_strings_and_comments(source)
    # skip restores entirely: they are inside placeholders, and the
    # placeholder digits are shielded by \x00 delimiters, so a
    # whole-word identifier regex cannot match digits inside \x00N\x00
    for old, new in mapping.items():
        masked = re.sub(r"(?<![\w$.])%s(?![\w$])" % re.escape(old), new, masked)
    return restore(masked, restores)

if __name__ == "__main__":
    path = pathlib.Path(sys.argv[1])
    mapping = {}
    for pair in sys.argv[2:]:
        old, new = pair.split("=", 1)
        mapping[old] = new
    result = rename_identifiers(path.read_text(), mapping)
    path.write_text(result)
    print(f"renamed {len(mapping)} identifiers in {path}")
