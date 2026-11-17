// ============================================================
// Layered Data — the AI pen: one call to the upstream model
//
// The geologist proposes, the staging judges, the refusal comes back
// to the model with its verdicts. An infrastructure error (no key,
// unreachable upstream) keeps its own status — the loop never
// retries it: the route passes it through.
// ============================================================
import {
  MISTRAL_API_KEY,
  MISTRAL_URL,
  MISTRAL_MODEL,
  SURVEY_MODEL,
  SURVEY_MAX_TOKENS,
  PEN_MAX_TOKENS,
} from "./config.ts";
import {
  buildSurveyPrompt,
  buildSystemPrompt,
  livingLayerNames,
  parseSurveyResponse,
  type VisitorLayer,
} from "./geologistPrompts.ts";

/** An infrastructure failure of the geologist — not a verdict, the loop
 * never retries it: the route passes it through with its status. */
export class PenInfraFailure {
  readonly statusCode: number;
  readonly body: string;

  constructor({ statusCode, body }: { statusCode: number; body: string }) {
    this.statusCode = statusCode;
    this.body = body;
  }
}


/** The upstream `content` is a plain string for most models, but
 * reasoning models (mistral-large-latest) answer with a list of
 * content blocks — thinking blocks first, then the text. Only the
 * text blocks carry the proposal. */
export function extractProposalContent({ content }: { content: unknown }): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("");
}

/** One call to the upstream model, with the shared guards: the key
 * must exist, the upstream must answer, the answer must carry a
 * proposal. The status of an upstream failure is preserved — never
 * masked as a generic bad gateway. */
async function callUpstream({
  model,
  maxTokens,
  cacheKey,
  system,
  user,
}: {
  model: string;
  maxTokens: number;
  cacheKey: string;
  system: string;
  user: string;
}): Promise<string> {
  if (!MISTRAL_API_KEY) {
    throw new PenInfraFailure({
      statusCode: 500,
      body: "pas de clé Mistral configurée (MISTRAL_API_KEY) — le géologue reste local",
    });
  }
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + MISTRAL_API_KEY },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // The system prompt is identical across users (survey) or
        // across the rounds of one intention (pen): the cache key
        // makes the shared prefix a cache hit.
        prompt_cache_key: cacheKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    throw new PenInfraFailure({
      statusCode: 502,
      body:
        "amont injoignable (" + MISTRAL_URL + ") : " + String((error as Error)?.message ?? error),
    });
  }
  if (!upstreamResponse.ok) {
    // The upstream error is passed through verbatim — a refused
    // key, an unknown model or an exhausted quota must not
    // disguise itself as a mute "bad gateway".
    const detail = (await upstreamResponse.text()).replace(/\s+/g, " ").slice(0, 300);
    throw new PenInfraFailure({
      statusCode: 502,
      body: "amont a répondu " + upstreamResponse.status + " (" + model + ") : " + detail,
    });
  }
  const data = (await upstreamResponse.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  return extractProposalContent({ content: data?.choices?.[0]?.message?.content });
}

/** The survey pass (issue #279): a fast model chooses the ground —
 * which living layers the new layer should refine or cite. Returns
 * either clarifying questions or the validated selection, closed
 * over its ancestors. An empty selection means "fall back to the
 * monolith prompt"; an upstream failure throws PenInfraFailure like
 * the pen does. */
export async function selectLayers({
  intention,
  answers = [],
  visitorLayers,
}: {
  intention: string;
  answers?: readonly string[];
  visitorLayers: VisitorLayer[];
}): Promise<
  | { kind: "questions"; questions: string[] }
  | { kind: "selection"; layers: string[]; selected: string[]; closure: string[] }
> {
  const user =
    answers.length > 0
      ? intention + "\n\n" + answers.map((answer) => "ANSWER: " + answer).join("\n")
      : intention;
  const raw = await callUpstream({
    model: SURVEY_MODEL,
    maxTokens: SURVEY_MAX_TOKENS,
    cacheKey: "layered-data-survey",
    system: buildSurveyPrompt({ visitorLayers }),
    user,
  });
  if (!raw.trim()) {
    throw new PenInfraFailure({ statusCode: 502, body: "le releveur n'a rien répondu" });
  }
  return parseSurveyResponse({
    text: raw,
    livingNames: livingLayerNames({ visitorLayers }),
    visitorLayers,
  });
}

/** One call to the upstream model. The feedback of a previous
 * refusal travels with the instruction — the correction happens in
 * the model's own writing, the verdict vocabulary speaks to it. */
export async function generateLayer({
  instruction,
  feedback,
  visitorLayers,
  selectedLayerNames,
}: {
  instruction: string;
  feedback: string | null;
  visitorLayers: VisitorLayer[];
  /** the survey's ground: the system prompt is cut to these layers
   * (issue #279); absent — the monolith prompt */
  selectedLayerNames?: readonly string[];
}): Promise<{ statusCode: number; body: string }> {
  const proposal = await callUpstream({
    model: MISTRAL_MODEL,
    maxTokens: PEN_MAX_TOKENS,
    cacheKey: "layered-data-pen-" + instruction,
    system: buildSystemPrompt(
      selectedLayerNames === undefined
        ? { visitorLayers }
        : { visitorLayers, selectedLayerNames },
    ),
    user: feedback === null ? instruction : instruction + "\n\n" + feedback,
  });
  if (!proposal.trim()) {
    throw new PenInfraFailure({ statusCode: 502, body: "le géologue n'a rien écrit" });
  }
  return { statusCode: 200, body: proposal };
}
