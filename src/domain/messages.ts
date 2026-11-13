// Kernel messages: the domain speaks facts, the boundary renders them.
// A MessageFact is a stable code plus named params — never a
// pre-rendered string — and renderMessage() turns it into English (the
// workshop default) or, when a template carries one, French. Codes are
// never translated: they travel through tests, verdicts and
// diagnostics as anchors of meaning.

/** The languages the workshop speaks. */
export type Language = "en" | "fr";

/** English is the default: the workshop opens in English unless the
 * browser or the visitor says otherwise. */
export const DEFAULT_LANGUAGE: Language = "en";

/** Named parameters of a message — strings and numbers only, so a
 * fact stays JSON-serializable and diffable. */
export type MessageParams = Record<string, string | number>;

/** A stable, untranslated message code plus its named parameters. */
export type MessageFact = {
  code: string;
  params?: MessageParams;
};

/** Build a fact: fact("dead-binding", { layer: "wb1", ... }). */
export function fact(code: string, params?: MessageParams): MessageFact {
  if (params === undefined) return { code };
  return { code, params };
}

/** A template renders the parameters into one language. English is
 * required; French is optional content — when absent, renderers fall
 * back to English (ADR-0113). */
export type MessageTemplate = {
  en: (params: MessageParams) => string;
  fr?: ((params: MessageParams) => string) | undefined;
};

/** Parameter access — p.layer reads a string, p.count reads a
 * number; a missing parameter renders as the empty string rather
 * than crashing a dump. */
function text(params: MessageParams, key: string): string {
  const value = params[key];
  return value === undefined ? "" : String(value);
}

/** All kernel message templates, indexed by stable code. English is
 * the workshop's tongue; a French template, when present, is pure
 * content that may return without any code change (ADR-0113). */
export const TEMPLATES: Record<string, MessageTemplate> = {
  // ---- validation verdicts (checks.ts) ----
  "implicit-overload": {
    en: (p) =>
      text(p, "where") + ' : "' + text(p, "key") + '" exists upstream — declare extend/override',
  },
  "ghost-declaration": {
    en: (p) =>
      text(p, "where") +
      ' : "' +
      text(p, "key") +
      '" (' +
      text(p, "mode") +
      ") does not exist upstream",
  },
  "unknown-label": {
    en: (p) => text(p, "layer") + ' : "' + text(p, "tag") + '"',
  },
  "dead-binding": {
    en: (p) =>
      text(p, "layer") +
      " : bind " +
      text(p, "slot") +
      " at the root, but " +
      text(p, "tag") +
      " (" +
      text(p, "readingLayer") +
      ") reads it at the instance level — lay it on the type",
  },
  "undeclared-shadow": {
    en: (p) =>
      text(p, "layer") +
      "::" +
      text(p, "path") +
      ' : "' +
      text(p, "key") +
      '" overwrites the upstream outside the language',
  },
  "expectation-betrayed": {
    en: (p) =>
      text(p, "layer") +
      " :: " +
      text(p, "address") +
      " : expected " +
      text(p, "expected") +
      ", read " +
      text(p, "read"),
  },
  "order-conflict": {
    en: (p) =>
      text(p, "where") +
      ' : "' +
      text(p, "key") +
      '" decided by order — ' +
      text(p, "winner") +
      " lays " +
      text(p, "winnerValue") +
      ", " +
      text(p, "loser") +
      " lays " +
      text(p, "loserValue") +
      " — first-wins walked the branches as written",
  },

  // ---- staging verdicts (staging.ts) ----
  "unknown-target": {
    en: (p) =>
      text(p, "layer") + ' : refines "' + text(p, "target") + '", layer unknown to the assembly',
  },

  // ---- space diagnostics (space.ts) ----
  "no-concrete-target": {
    en: () => "target without a concrete node",
  },
  "ref-not-found": {
    en: (p) => "ref " + text(p, "ref") + " — anchor not found or path interrupted",
  },
  "ref-scalar": {
    en: (p) => "ref " + text(p, "ref") + " — resolves to a scalar, not an address",
  },
  "entry-not-designating": {
    en: (p) => "non-designating entry: " + text(p, "entry"),
  },
  // the cycle guard stays a silence in both languages — an
  // interrupted walk says it by where it stopped, not by a detail
  "cycle-guard": {
    en: () => "",
  },

  // ---- lint events (linting.ts) ----
  "refines-inverted": {
    en: (p) => text(p, "specific") + " (specific) follows " + text(p, "generic") + " (generic)",
  },
  shadow: {
    en: (p) =>
      text(p, "key") +
      " — winner " +
      text(p, "winner") +
      "::" +
      text(p, "path") +
      " ; " +
      text(p, "sources") +
      " sources",
  },
  "label-unknown": {
    en: (p) => "unknown label: " + text(p, "tag"),
  },
  "vacuous-bounds": {
    en: () => "cardinality bounds read, collection root never reached",
  },

  // ---- language checks (checks.ts) ----
  "edges-slot-unbound": {
    en: () => "edges slot unbound",
  },
  "slots-unbound": {
    en: (p) => "unbound slots (" + text(p, "slots") + ")",
  },
  "vacant-slot": {
    en: (p) =>
      text(p, "where") +
      " : the check « " +
      text(p, "tag") +
      " » cannot judge — the slot « " +
      text(p, "slot") +
      " » is unbound (ADR-0101)",
  },
  "check-betrayed": {
    en: (p) => text(p, "where") + " : the carried check refuses — " + text(p, "error"),
  },
  "algorithm-missing": {
    en: (p) =>
      "the check « " +
      text(p, "tag") +
      " » is declared in the registry but no algorithm executes it (ADR-0102)",
  },
  // ---- the declarative strate's facts (ADR-0105) ----
  "redefined-check": {
    en: (p) =>
      text(p, "where") +
      " : the check « " +
      text(p, "name") +
      " » is re-posed divergently (" +
      text(p, "first") +
      " then " +
      text(p, "second") +
      ") — a couple is never replaced (ADR-0105)",
  },
  "unsupported-level": {
    en: (p) =>
      text(p, "where") +
      " : the check « " +
      text(p, "name") +
      " » judges at the level « " +
      text(p, "level") +
      " » — the reading strate judges at layer roots only",
  },
  "missing-condition": {
    en: (p) =>
      text(p, "where") +
      " : the judgment of « " +
      text(p, "name") +
      " » carries a « when » but the couple declares no condition",
  },
  "unreadable-formula": {
    en: (p) =>
      "the check « " +
      text(p, "tag") +
      " » carries an unreadable formula: " +
      text(p, "detail") +
      " (ADR-0105)",
  },
  "template-out-of-scope": {
    en: (p) =>
      text(p, "where") +
      " : the message of « " +
      text(p, "name") +
      " » names « " +
      text(p, "term") +
      " », outside the judgment's quantified scope",
  },
  "exhausted-formula": {
    en: (p) =>
      "the check « " +
      text(p, "tag") +
      " » exhausted its budget (" +
      text(p, "steps") +
      " steps) — it never judges silently",
  },
  "contract-without-algorithm": {
    en: (p) =>
      "the registry declares « " +
      text(p, "tag") +
      " » but the kernel binds no algorithm to it (ADR-0102)",
  },
  "algorithm-without-contract": {
    en: (p) =>
      "the kernel binds an algorithm for « " +
      text(p, "tag") +
      " » that the registry never declares (ADR-0102)",
  },
  "contract-unreadable": {
    en: (p) =>
      text(p, "where") +
      " : the contract of « " +
      text(p, "tag") +
      " » is unreadable — a clause the kernel cannot parse (ADR-0102)",
  },
  "bedrock-occupied": {
    en: (p) =>
      "the name « " +
      text(p, "layer") +
      " » belongs to the bedrock — the read-only corpus: its layers are never rewritten, a draft may refine them, never replace them (ADR-0103)",
  },
  "kernel-shadowing": {
    en: (p) =>
      "the visitors' layer « " +
      text(p, "layer") +
      " » masks a bedrock name — the contextual resolution (user, then kernel) would hide the read-only layer: rename the visitor layer (issue #145)",
  },
  "version-conflict": {
    en: (p) =>
      "the formalism « " +
      text(p, "formalism") +
      " » is pinned to divergent majors (" +
      text(p, "majors") +
      ") in this assembly — one major per name per closure (ADR-0116 rule 3): re-pin one of the diamond paths",
  },
};

/** All message codes, in template declaration order. */
export function messageCodes(): string[] {
  return Object.keys(TEMPLATES);
}

/** Render a fact into a language. An unknown code renders as the code
 * followed by its parameters — total, never an exception, and a
 * readable trace of what the domain forgot to declare. */
export function renderMessage({
  message,
  language = DEFAULT_LANGUAGE,
}: {
  message: MessageFact;
  language?: Language;
}): string {
  const template = TEMPLATES[message.code];
  if (template === undefined) {
    const params = message.params === undefined ? "" : " " + JSON.stringify(message.params);
    return message.code + params;
  }
  const params = message.params ?? {};
  if (language === "fr" && template.fr !== undefined) return template.fr(params);
  return template.en(params);
}

/** Pick one of two ephemeral texts — English by default, and the
 * fallback when no French text is present. Used for compositions that
 * never enter the kernel (syntax errors, geologist feedback), where
 * the pair is written at the call site. */
export function parseText({
  language = DEFAULT_LANGUAGE,
  en,
  fr,
}: {
  language?: Language;
  en: string;
  fr?: string | undefined;
}): string {
  return language === "fr" && fr !== undefined ? fr : en;
}

/** Stable kernel vocabulary — statuses, kinds, steps: the codes the
 * UI displays next to values. The keys are the kernel's stable French
 * codes, not translations; English translates them, French is
 * optional content that falls back to English (ADR-0113). */
export const VOCABULARY: Record<string, { en: string; fr?: string | undefined }> = {
  // ---- statuses ----
  fournit: { en: "provides"},
  transparent: { en: "transparent"},
  absent: { en: "absent"},
  "non atteint": { en: "not reached"},

  // ---- verdict and diagnostic kinds ----
  syntaxe: { en: "syntax"},
  validation: { en: "validation"},
  "attendu-trahi": { en: "expectation-betrayed"},
  "cible-inconnue": { en: "unknown-target"},
  "surcharge-implicite": { en: "implicit-overload"},
  "déclaration-fantôme": { en: "ghost-declaration"},
  "liaison-morte": { en: "dead-binding"},
  "ombre-non-déclarée": { en: "undeclared-shadow"},
  "conflit-d'ordre": { en: "order-conflict"},
  "étiquette-inconnue": { en: "unknown-label"},
  "entrée-ignorée": { en: "entry-ignored"},
  "garde-de-cycle": { en: "cycle-guard"},
  "check-vacant": { en: "check-vacant"},
  "check-trahi": { en: "check-betrayed"},
  "algorithme-absent": { en: "algorithm-missing"},
  "contrat-sans-algorithme": { en: "contract-without-algorithm"},
  "algorithme-sans-contrat": { en: "algorithm-without-contract"},
  "contrat-illisible": { en: "contract-unreadable"},
  "check-redéfini": { en: "redefined-check"},
  "niveau-non-soutenu": { en: "unsupported-level"},
  "condition-manquante": { en: "missing-condition"},
  "formule-illisible": { en: "unreadable-formula"},
  "gabarit-hors-de-portée": { en: "template-out-of-scope"},
  "formule-épuisée": { en: "exhausted-formula"},
  "socle-occupé": { en: "bedrock-occupied"},
  "masquage-socle": { en: "kernel-shadowing"},
  "conflit-de-version": { en: "version-conflict"},
  "refines-inversés": { en: "refines-inverted"},
  "ombre-émergente": { en: "emerging-shadow"},
  ombre: { en: "shadow"},
  cible: { en: "target"},
  propre: { en: "own"},
  "membre-du-père": { en: "member-of-parent"},
  union: { en: "union"},
  "vue-courante": { en: "current-view"},
  "couche-étrangère": { en: "foreign-layer"},
  introuvable: { en: "not found"},
  "chemin interrompu": { en: "path interrupted"},
};

/** Label of a kernel code in a language — statuses, kinds, steps.
 * An unknown code renders as itself, uppercase-neutral. */
export function kernelLabel({
  code,
  language = DEFAULT_LANGUAGE,
}: {
  code: string;
  language?: Language;
}): string {
  const entry = VOCABULARY[code];
  if (entry === undefined) return code;
  return language === "fr" && entry.fr !== undefined ? entry.fr : entry.en;
}
