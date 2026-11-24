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

/** One call to the upstream model, with the shared guards: a token
 * must exist (LD-8: the visitor's personal token from the
 * x-mistral-api-token header takes precedence over the dev-only
 * MISTRAL_API_KEY), the upstream must answer, the answer must carry
 * a proposal. The status of an upstream failure is preserved — never
 * masked as a generic bad gateway — and a refused token stays a 401.
 * The token itself is never logged nor echoed in a body. */
async function callUpstream({
  model,
  maxTokens,
  cacheKey,
  system,
  user,
  apiToken,
}: {
  model: string;
  maxTokens: number;
  cacheKey: string;
  system: string;
  user: string;
  /** the visitor's personal Mistral token (LD-8), header-sourced */
  apiToken?: string | undefined;
}): Promise<string> {
  // LD-8 (ADR-0120 §3): the header token wins; the env key is the
  // dev-only fallback (ignored in production, see config.ts).
  const bearerToken = apiToken ?? MISTRAL_API_KEY;
  if (!bearerToken) {
    throw new PenInfraFailure({
      statusCode: 401,
      body: "aucun token Mistral — ajoutez votre token personnel dans les préférences du site",
    });
  }
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + bearerToken },
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
    // LD-8: a 401 from the upstream means the personal token was
    // refused — it stays a 401 (never a 502) and its body is fixed,
    // so no echo of the request can leak the token.
    if (upstreamResponse.status === 401) {
      throw new PenInfraFailure({
        statusCode: 401,
        body: "token Mistral refusé par l’amont (401) — vérifiez votre token personnel",
      });
    }
    // The upstream error is passed through verbatim — an unknown
    // model or an exhausted quota must not disguise itself as a
    // mute "bad gateway".
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
  apiToken,
}: {
  intention: string;
  answers?: readonly string[];
  visitorLayers: VisitorLayer[];
  /** the visitor's personal Mistral token (LD-8, header-sourced) */
  apiToken?: string | undefined;
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
    apiToken,
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
  apiToken,
}: {
  instruction: string;
  feedback: string | null;
  visitorLayers: VisitorLayer[];
  /** the survey's ground: the system prompt is cut to these layers
   * (issue #279); absent — the monolith prompt */
  selectedLayerNames?: readonly string[];
  /** the visitor's personal Mistral token (LD-8, header-sourced) */
  apiToken?: string | undefined;
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
    apiToken,
  });
  if (!proposal.trim()) {
    throw new PenInfraFailure({ statusCode: 502, body: "le géologue n'a rien écrit" });
  }
  return { statusCode: 200, body: proposal };
}
