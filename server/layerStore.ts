// ============================================================
// Layered Data — the quarry on disk: layer names, lookup, writes
// ============================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_LAYER_NAMES as CANONICAL_LAYER_NAMES } from "../src/application/corpus.ts";
import { KERNEL_DIRECTORY, USERS_DIRECTORY } from "./config.ts";

/** A layer name as it appears in a URL: lowercase letters,
 * digits and dashes. The brand keeps names from being confused
 * with arbitrary strings. */
declare const layerNameBrand: unique symbol;
export type LayerName = string & { readonly [layerNameBrand]: never };

const LAYER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Accept a URL segment as a layer name, or explain the refusal. */
export function asLayerName({
  candidate,
}: {
  candidate: string;
}): { name: LayerName } | { reason: string } {
  if (LAYER_NAME_PATTERN.test(candidate)) {
    return { name: candidate as LayerName };
  }
  return { reason: "nom invalide : minuscules, chiffres, tirets" };
}

/** List the layer names of a quarry folder, sorted. An absent
 * folder is an empty quarry, never an exception. */
export function listLayerNames({ directory }: { directory: string }): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".ld"))
    .map((fileName) => fileName.slice(0, -3))
    .sort();
}

export const KERNEL_LAYER_NAMES = listLayerNames({ directory: KERNEL_DIRECTORY });

/** The kernel layer sources keyed by name — the assembly input of the
 * fresh bedrock each editor gesture is judged against. */
export const KERNEL_LAYER_SOURCES: Record<string, string> = Object.fromEntries(
  CANONICAL_LAYER_NAMES.map((name) => [
    String(name),
    readFileSync(kernelLayerPath({ name: String(name) as LayerName }), "utf8"),
  ]),
);

/** The kernel language source, in the canonical layer order, joined
 * once at startup: the geologist loop stages every proposal over this
 * text. The visitors' layers join per call — a layer written
 * seconds ago stays refinable for the geologist. */
export const KERNEL_LANGUAGE_SOURCE = CANONICAL_LAYER_NAMES.map((name) => {
  const source = readFileSync(kernelLayerPath({ name: String(name) as LayerName }), "utf8");
  return source.endsWith("\n") ? source : source + "\n";
}).join("");

/** The path of a kernel layer — read-only ground. */
export function kernelLayerPath({ name }: { name: LayerName }): string {
  return join(KERNEL_DIRECTORY, name + ".ld");
}

/** The path of a user layer — the writable quarry. */
export function userLayerPath({ name }: { name: LayerName }): string {
  return join(USERS_DIRECTORY, name + ".ld");
}

/** What a lookup found: a layer's source and where it lives.
 * The user quarry wins over the kernel — a visitor may shadow
 * a read-only name with their own writing. */
export type LayerLookup =
  { found: false } | { found: true; location: "kernel" | "users"; source: string };

export function lookupLayer({ name }: { name: LayerName }): LayerLookup {
  if (existsSync(userLayerPath({ name }))) {
    return {
      found: true,
      location: "users",
      source: readFileSync(userLayerPath({ name }), "utf8"),
    };
  }
  if (KERNEL_LAYER_NAMES.includes(name)) {
    return {
      found: true,
      location: "kernel",
      source: readFileSync(kernelLayerPath({ name }), "utf8"),
    };
  }
  return { found: false };
}

/** Write a user layer (the kernel refuses). A trailing newline is
 * added: every layer file ends with one. */
export function writeUserLayer({ name, source }: { name: LayerName; source: string }): {
  created: boolean;
} {
  const created = !existsSync(userLayerPath({ name }));
  const normalized = source.endsWith("\n") ? source : source + "\n";
  writeFileSync(userLayerPath({ name }), normalized);
  return { created };
}

/** Delete a user layer (the kernel refuses). */
export function deleteUserLayer({ name }: { name: LayerName }): void {
  unlinkSync(userLayerPath({ name }));
}
