// The verified pen loop — the server-side use case.
//
// The pen proposes, the staging judges: every proposal is staged
// over the living corpus before it reaches anyone, and a refusal
// comes back to the model with its reasons — the observable verdict
// vocabulary of the kernel — until the draft is accepted or the
// attempt budget is spent. The model never applies anything, the
// client never receives an unverified draft, and the staging of
// the workshop (in the browser) remains the final judge: the loop
// is a gate, not a replacement.
//
// Pure use case: the model call is injected (the server wires its
// fetch), the corpus sources are passed in — no Node, no network,
// no clock here. The loop is therefore testable offline, against a
// deterministic pen that fails and corrects itself.

import { stageLayerAddition, type StagingOutcome } from "./staging.ts";
import type { Verdict } from "../domain/validation.ts";
import {
  DEFAULT_LANGUAGE,
  kernelLabel,
  parseText,
  renderMessage,
  type Language,
} from "../domain/messages.ts";

/** What the pen receives at each round: the intention, the number
 * of the proposal being asked, and the refusal of the previous
 * proposal — null on the first round. */
export interface PenRound {
  attempt: number;
  instruction: string;
  feedback: string | null;
}

/** The pen itself — the injected model call. Returns the proposed
 * layer source, plain text. Infrastructure failures (missing key,
 * unreachable upstream) throw: they are not verdicts, the loop does
 * not retry them. */
export type PenPropose = (round: PenRound) => Promise<string>;

/** One judged refusal, in order — the observable trace of the loop. */
export interface PenRefusal {
  attempt: number;
  step: StagingOutcome["step"];
  errors: string[];
  verdicts: Verdict[];
  proposal: string;
  feedback: string;
}

/** The outcome of the loop. `ok` carries the accepted draft source
 * and its staging; a spent budget carries the refusals, in order. */
export interface PenLoopOutcome {
  ok: boolean;
  attempts: number;
  draftSource: string | null;
  staging: StagingOutcome | null;
  refusals: PenRefusal[];
}

/** The refusal as the pen reads it: the observable vocabulary of the
 * kernel (steps, verdict kinds) plus the rendered facts, in the
 * workshop language — English by default, French its mirror. */
export function formatPenFeedback(refusal: PenRefusal, language: Language = DEFAULT_LANGUAGE): string {
  const { attempt, step, errors, verdicts } = refusal;
  const lines: string[] = [
    parseText({
      language,
      en:
        'Your proposal #' + attempt + ' was refused by the verification, at the step "' +
        kernelLabel({ code: step, language }) + '".',
      fr:
        "Ta proposition n°" + attempt + " a été refusée par la vérification, à l'étape « " +
        kernelLabel({ code: step, language }) + " ».",
    }),
  ];
  for (const error of errors) {
    lines.push(parseText({ language, en: "Error: " + error, fr: "Erreur : " + error }));
  }
  for (const verdict of verdicts) {
    lines.push(
      parseText({
        language,
        en:
          'Verdict "' + kernelLabel({ code: verdict.kind, language }) + '": ' +
          renderMessage({ message: verdict.fact, language }),
        fr:
          "Verdict « " + kernelLabel({ code: verdict.kind, language }) + " » : " +
          renderMessage({ message: verdict.fact, language }),
      }),
    );
  }
  lines.push(
    parseText({
      language,
      en: "Fix it and propose the complete, corrected layer, in the workshop language, with no explanation.",
      fr: "Corrige et repose la couche complète, corrigée, en langage de l'atelier, sans explication.",
    }),
  );
  return lines.join("\n");
}

/** The verified composition: propose → stage → refuse with reasons
 * or accept. The trunk and the already-written layers form the
 * living space the draft is judged against; the judge is the exact
 * staging the workshop itself applies. */
export async function composeVerifiedLayerDraft({
  instruction,
  languageSource,
  livingLayerNames,
  previousAdditionSources = [],
  maxAttempts = 3,
  language = DEFAULT_LANGUAGE,
  strictConflicts = false,
  propose,
}: {
  instruction: string;
  languageSource: string;
  livingLayerNames: readonly string[];
  previousAdditionSources?: readonly string[];
  maxAttempts?: number;
  /** the workshop language the feedback speaks — the pen hears the
   * kernel's vocabulary in the language the workshop renders it */
  language?: Language;
  /** refuse unsigned order conflicts too — the strict arm of the
   * loop (ADR-0017): the pen may propose an order-decided read only
   * if the reading address signs an `assume` */
  strictConflicts?: boolean;
  propose: PenPropose;
}): Promise<PenLoopOutcome> {
  const refusals: PenRefusal[] = [];
  let feedback: string | null = null;
  // The budget has a floor of one: a zero-attempt loop would answer
  // a refusal without a last refusal to read.
  const budget = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= budget; attempt++) {
    const proposal = (await propose({ attempt, instruction, feedback })).trim();

    // A mute pen is a refused pen — an empty proposal would stage
    // as "no new layer" and sneak through as an empty acceptance.
    if (proposal === "") {
      const refusal: PenRefusal = {
        attempt,
        step: "syntaxe",
        errors: [parseText({ language, en: "the proposal is empty", fr: "la proposition est vide" })],
        verdicts: [],
        proposal,
        feedback: "",
      };
      refusal.feedback = formatPenFeedback(refusal, language);
      feedback = refusal.feedback;
      refusals.push(refusal);
      continue;
    }

    const staging = stageLayerAddition({
      languageSource,
      previousAdditionSources: [...previousAdditionSources],
      draftSource: proposal,
      livingLayerNames: [...livingLayerNames],
      language,
      strictConflicts,
    });
    if (staging.ok) {
      return { ok: true, attempts: attempt, draftSource: proposal, staging, refusals };
    }

    const refusal: PenRefusal = {
      attempt,
      step: staging.step,
      errors: [...staging.errors],
      verdicts: [...staging.verdicts],
      proposal,
      feedback: "",
    };
    refusal.feedback = formatPenFeedback(refusal, language);
    feedback = refusal.feedback;
    refusals.push(refusal);
  }

  return { ok: false, attempts: budget, draftSource: null, staging: null, refusals };
}
