// The tutorial's markdown dialect — a small, hand-editable surface.
// The tutorial prose lives in two files (tutorial.en.md,
// tutorial.fr.md), edited by hand, read by the app at build time;
// this module is the measured dialect they may use: headings,
// paragraphs, bullet lists, code fences — and one directive fence,
// `ldflat:<layer>`, which the page resolves at run time into the
// interactive flattened listing of the tutorial corpus. The parser
// is pure: blocks in, no kernel reads, no state.

import type { FlattenedSection } from "../application/flattenSource.ts";

/** One block of the tutorial, in document order. The listing block
 * carries the layer name — the page resolves it against the
 * tutorial corpus; an unknown name is the page's error, never the
 * parser's. */
export type TutorialBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; language: string; source: string }
  | { kind: "listing"; layer: string };

/** The fence directive prefix that opens an interactive listing:
 * `ldflat:petrinet` renders the flattened formalism of petrinet,
 * resolved from the tutorial corpus at run time — never a frozen
 * copy in the markdown. */
const LISTING_FENCE = "ldflat:";

/** Parse the tutorial markdown: headings (# to ####), paragraphs,
 * bullet lists, code fences. Blank lines separate blocks; list
 * items continue while lines start with "- "; fence lines are
 * taken verbatim (the artifact feeds both tongues unchanged). */
export function parseTutorialMarkdown({ source }: { source: string }): TutorialBlock[] {
  const blocks: TutorialBlock[] = [];
  const lines = source.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index++;
      continue;
    }
    if (line.startsWith("```")) {
      const info = line.slice(3).trim();
      index++;
      const fenceLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        fenceLines.push(lines[index]);
        index++;
      }
      index++; // the closing fence
      if (info.startsWith(LISTING_FENCE)) {
        blocks.push({ kind: "listing", layer: info.slice(LISTING_FENCE.length).trim() });
      } else {
        blocks.push({ kind: "code", language: info, source: fenceLines.join("\n") });
      }
      continue;
    }
    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch !== null) {
      blocks.push({ kind: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      index++;
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim());
        index++;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !lines[index].startsWith("```") && !/^#{1,4}\s/.test(lines[index]) && !lines[index].startsWith("- ")) {
      paragraphLines.push(lines[index].trim());
      index++;
    }
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ") });
  }
  return blocks;
}

/** The layers an interactive listing directive asks for, in document
 * order — the harness pins the agreement with the tutorial corpus. */
export function listingLayersOf({ blocks }: { blocks: TutorialBlock[] }): string[] {
  return blocks.filter((block) => block.kind === "listing").map((block) => (block as { layer: string }).layer);
}

/** The lines a listing widget renders: the note special key stays
 * out (the .ld file's prose belongs to the file), everything else
 * counts — the folded view never lies about what it hides. */
export function countListingLines({ sections }: { sections: FlattenedSection[] }): number {
  return sections.reduce(
    (total, section) =>
      section.key === "note"
        ? total
        : total + 1 + (section.value !== null ? section.value.split("\n").length - 1 : 0) + countListingLines({ sections: section.sections }),
    0,
  );
}

/** The visible size of a whole listing — what decides whether the
 * page leaves it open or opens it folded. */
export function listingVisibleLines({ sections }: { sections: FlattenedSection[] }): number {
  return countListingLines({ sections });
}
