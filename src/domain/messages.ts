// Bilingual kernel messages: the domain speaks facts, the boundary
// renders them. A MessageFact is a stable code plus named params —
// never a pre-rendered string — and renderMessage() turns it into
// English (the workshop default) or French, the two languages the
// workshop chrome speaks. Codes are never translated: they travel
// through tests, verdicts and diagnostics as anchors of meaning.

/** The languages the workshop speaks. */
export type Language = "en" | "fr";

/** English is the default: the workshop opens in English unless the
 * browser or the visitor says otherwise. */
export const DEFAULT_LANGUAGE: Language = "en";

/** The languages messages render in — used by the audit to dump the
 * kernel twice, once per language. */
export const MESSAGE_LANGUAGES: readonly Language[] = ["en", "fr"];

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

/** A template renders the parameters into one language. */
export type MessageTemplate = {
  en: (params: MessageParams) => string;
  fr: (params: MessageParams) => string;
};

/** Parameter access — p.layer reads a string, p.count reads a
 * number; a missing parameter renders as the empty string rather
 * than crashing a dump. */
function text(params: MessageParams, key: string): string {
  const value = params[key];
  return value === undefined ? "" : String(value);
}

/** All kernel message templates, indexed by stable code. The French
 * templates reproduce the historic kernel wording exactly — the
 * French audit half must stay byte-identical from one version to
 * the next; the English templates are the workshop's new tongue. */
export const TEMPLATES: Record<string, MessageTemplate> = {
  // ---- validation verdicts (checks.ts) ----
  "implicit-overload": {
    en: (p) =>
      text(p, "where") + ' : "' + text(p, "key") + '" exists upstream — declare extend/override',
    fr: (p) =>
      text(p, "where") + " : « " + text(p, "key") + " » existe en amont — déclarez extend/override",
  },
  "ghost-declaration": {
    en: (p) =>
      text(p, "where") + ' : "' + text(p, "key") + '" (' + text(p, "mode") + ") does not exist upstream",
    fr: (p) =>
      text(p, "where") + " : « " + text(p, "key") + " » (" + text(p, "mode") + ") n'existe pas en amont",
  },
  "unknown-label": {
    en: (p) => text(p, "layer") + ' : "' + text(p, "tag") + '"',
    fr: (p) => text(p, "layer") + " : « " + text(p, "tag") + " »",
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
    fr: (p) =>
      text(p, "layer") +
      " : bind " +
      text(p, "slot") +
      " à la racine, mais " +
      text(p, "tag") +
      " (" +
      text(p, "readingLayer") +
      ") le lit au niveau instance — posez-le sur le type",
  },
  "undeclared-shadow": {
    en: (p) =>
      text(p, "layer") + "::" + text(p, "path") + ' : "' + text(p, "key") + '" overwrites the upstream outside the language',
    fr: (p) =>
      text(p, "layer") + "::" + text(p, "path") + " : « " + text(p, "key") + " » écrase l'amont hors langage",
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
    fr: (p) =>
      text(p, "layer") +
      " :: " +
      text(p, "address") +
      " : attendu " +
      text(p, "expected") +
      ", lu " +
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
    fr: (p) =>
      text(p, "where") +
      " : « " +
      text(p, "key") +
      " » tranché par l'ordre — " +
      text(p, "winner") +
      " pose " +
      text(p, "winnerValue") +
      ", " +
      text(p, "loser") +
      " pose " +
      text(p, "loserValue") +
      " — le premier-gagné a traversé les branches telles qu'elles sont écrites",
  },
  "ghost-assume": {
    en: (p) =>
      text(p, "where") +
      ' : "' +
      text(p, "key") +
      '" signed with an assume — no read is decided by order here',
    fr: (p) =>
      text(p, "where") +
      " : « " +
      text(p, "key") +
      " » signé d'un assume — aucune lecture ne se tranche par l'ordre ici",
  },

  // ---- staging verdicts (staging.ts) ----
  "unknown-target": {
    en: (p) =>
      text(p, "layer") + ' : refines "' + text(p, "target") + '", layer unknown to the assembly',
    fr: (p) =>
      text(p, "layer") + " : raffine « " + text(p, "target") + " », couche inconnue de l'assemblage",
  },

  // ---- space diagnostics (space.ts) ----
  "no-concrete-target": {
    en: () => "target without a concrete node",
    fr: () => "cible sans nœud concret",
  },
  "ref-not-found": {
    en: (p) => "ref " + text(p, "ref") + " — anchor not found or path interrupted",
    fr: (p) => "ref " + text(p, "ref") + " — ancre introuvable ou chemin interrompu",
  },
  "ref-masked": {
    en: (p) => "ref " + text(p, "ref") + " — masked",
    fr: (p) => "ref " + text(p, "ref") + " — masquée",
  },
  "ref-scalar": {
    en: (p) => "ref " + text(p, "ref") + " — resolves to a scalar, not an address",
    fr: (p) => "ref " + text(p, "ref") + " — résout en scalaire, pas une adresse",
  },
  "entry-not-designating": {
    en: (p) => "non-designating entry: " + text(p, "entry"),
    fr: (p) => "entrée non désignante : " + text(p, "entry"),
  },
  // the cycle guard stays a silence in both languages — an
  // interrupted walk says it by where it stopped, not by a detail
  "cycle-guard": {
    en: () => "",
    fr: () => "",
  },

  // ---- lint events (linting.ts) ----
  "refines-inverted": {
    en: (p) => text(p, "specific") + " (specific) follows " + text(p, "generic") + " (generic)",
    fr: (p) => text(p, "specific") + " (spécifique) suit " + text(p, "generic") + " (générique)",
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
    fr: (p) =>
      text(p, "key") +
      " — gagnant " +
      text(p, "winner") +
      "::" +
      text(p, "path") +
      " ; " +
      text(p, "sources") +
      " sources",
  },
  "label-unknown": {
    en: (p) => "unknown label: " + text(p, "tag"),
    fr: (p) => text(p, "tag"),
  },
  "vacuous-bounds": {
    en: () => "cardinality bounds read, collection root never reached",
    fr: () => "bornes de cardinalité lues, racine collection jamais atteinte",
  },

  // ---- language checks (checks.ts) ----
  "edges-slot-unbound": {
    en: () => "edges slot unbound",
    fr: () => "slot edges non lié",
  },
  "slots-unbound": {
    en: (p) => "unbound slots (" + text(p, "slots") + ")",
    fr: (p) => "slots non liés (" + text(p, "slots") + ")",
  },
  "vacant-slot": {
    en: (p) =>
      text(p, "where") +
      " : the check « " +
      text(p, "tag") +
      " » cannot judge — the slot « " +
      text(p, "slot") +
      " » is unbound (ADR-0018)",
    fr: (p) =>
      text(p, "where") +
      " : le check « " +
      text(p, "tag") +
      " » ne peut pas juger — le slot « " +
      text(p, "slot") +
      " » n'est pas lié (ADR-0018)",
  },
  "check-betrayed": {
    en: (p) =>
      text(p, "where") +
      " : the carried check refuses — " +
      text(p, "error"),
    fr: (p) =>
      text(p, "where") +
      " : le check porté refuse — " +
      text(p, "error"),
  },
  "algorithm-missing": {
    en: (p) =>
      "the check « " +
      text(p, "tag") +
      " » is declared in the registry but no algorithm executes it (ADR-0019)",
    fr: (p) =>
      "le check « " +
      text(p, "tag") +
      " » est déclaré dans le registre mais aucun algorithme ne l'exécute (ADR-0019)",
  },
  "contract-without-algorithm": {
    en: (p) =>
      "the registry declares « " +
      text(p, "tag") +
      " » but the kernel binds no algorithm to it (ADR-0019)",
    fr: (p) =>
      "le registre déclare « " +
      text(p, "tag") +
      " » mais le noyau ne lui lie aucun algorithme (ADR-0019)",
  },
  "algorithm-without-contract": {
    en: (p) =>
      "the kernel binds an algorithm for « " +
      text(p, "tag") +
      " » that the registry never declares (ADR-0019)",
    fr: (p) =>
      "le noyau lie un algorithme pour « " +
      text(p, "tag") +
      " » que le registre ne déclare pas (ADR-0019)",
  },
  "contract-unreadable": {
    en: (p) =>
      text(p, "where") +
      " : the contract of « " +
      text(p, "tag") +
      " » is unreadable — a clause the kernel cannot parse (ADR-0019)",
    fr: (p) =>
      text(p, "where") +
      " : le contrat de « " +
      text(p, "tag") +
      " » est illisible — une clause que le noyau ne sait pas lire (ADR-0019)",
  },
  "trunk-occupied": {
    en: (p) =>
      "the name « " +
      text(p, "layer") +
      " » belongs to the trunk — the read-only corpus: its layers are never rewritten, a draft may refine them, never replace them (ADR-0020)",
    fr: (p) =>
      "le nom « " +
      text(p, "layer") +
      " » appartient au tronc — le corpus en lecture seule : ses couches ne se réécrivent jamais, un brouillon peut les raffiner, jamais les remplacer (ADR-0020)",
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
  const rendered =
    language === "fr" ? template.fr(message.params ?? {}) : template.en(message.params ?? {});
  return rendered;
}

/** Pick one of two ephemeral texts — English by default. Used for
 * compositions that never enter the kernel (syntax errors, pen
 * feedback), where the pair is written at the call site. */
export function parseText({ language = DEFAULT_LANGUAGE, en, fr }: {
  language?: Language;
  en: string;
  fr: string;
}): string {
  return language === "fr" ? fr : en;
}

/** Stable kernel vocabulary — statuses, kinds, steps: the codes the
 * UI displays next to values. French keeps the historic code as its
 * label; English translates it. */
export const VOCABULARY: Record<string, { en: string; fr: string }> = {
  // ---- statuses ----
  "fournit": { en: "provides", fr: "fournit" },
  "masqué": { en: "masked", fr: "masqué" },
  transparent: { en: "transparent", fr: "transparent" },
  absent: { en: "absent", fr: "absent" },
  "non atteint": { en: "not reached", fr: "non atteint" },

  // ---- verdict and diagnostic kinds ----
  syntaxe: { en: "syntax", fr: "syntaxe" },
  validation: { en: "validation", fr: "validation" },
  "attendu-trahi": { en: "expectation-betrayed", fr: "attendu-trahi" },
  "cible-inconnue": { en: "unknown-target", fr: "cible-inconnue" },
  "surcharge-implicite": { en: "implicit-overload", fr: "surcharge-implicite" },
  "déclaration-fantôme": { en: "ghost-declaration", fr: "déclaration-fantôme" },
  "liaison-morte": { en: "dead-binding", fr: "liaison-morte" },
  "ombre-non-déclarée": { en: "undeclared-shadow", fr: "ombre-non-déclarée" },
  "conflit-d'ordre": { en: "order-conflict", fr: "conflit-d'ordre" },
  "assume-fantôme": { en: "ghost-assume", fr: "assume-fantôme" },
  "étiquette-inconnue": { en: "unknown-label", fr: "étiquette-inconnue" },
  "entrée-ignorée": { en: "entry-ignored", fr: "entrée-ignorée" },
  "garde-de-cycle": { en: "cycle-guard", fr: "garde-de-cycle" },
  "check-vacant": { en: "check-vacant", fr: "check-vacant" },
  "check-trahi": { en: "check-betrayed", fr: "check-trahi" },
  "algorithme-absent": { en: "algorithm-missing", fr: "algorithme-absent" },
  "contrat-sans-algorithme": { en: "contract-without-algorithm", fr: "contrat-sans-algorithme" },
  "algorithme-sans-contrat": { en: "algorithm-without-contract", fr: "algorithme-sans-contrat" },
  "contrat-illisible": { en: "contract-unreadable", fr: "contrat-illisible" },
  "tronc-occupé": { en: "trunk-occupied", fr: "tronc-occupé" },
  "refines-inversés": { en: "refines-inverted", fr: "refines-inversés" },
  "ombre-émergente": { en: "emerging-shadow", fr: "ombre-émergente" },
  ombre: { en: "shadow", fr: "ombre" },
  "cible": { en: "target", fr: "cible" },
  propre: { en: "own", fr: "propre" },
  "membre-du-père": { en: "member-of-parent", fr: "membre-du-père" },
  union: { en: "union", fr: "union" },
  "vue-courante": { en: "current-view", fr: "vue-courante" },
  "couche-étrangère": { en: "foreign-layer", fr: "couche-étrangère" },
  introuvable: { en: "not found", fr: "introuvable" },
  "chemin interrompu": { en: "path interrupted", fr: "chemin interrompu" },
};

/** Label of a kernel code in a language — statuses, kinds, steps.
 * An unknown code renders as itself, uppercase-neutral. */
export function kernelLabel({ code, language = DEFAULT_LANGUAGE }: {
  code: string;
  language?: Language;
}): string {
  const entry = VOCABULARY[code];
  if (entry === undefined) return code;
  return language === "fr" ? entry.fr : entry.en;
}
