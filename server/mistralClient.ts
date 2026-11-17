// ============================================================
// Layered Data — the AI pen: one call to the upstream model
//
// The geologist proposes, the staging judges, the refusal comes back
// to the model with its verdicts. An infrastructure error (no key,
// unreachable upstream) keeps its own status — the loop never
// retries it: the route passes it through.
// ============================================================
import { MISTRAL_API_KEY, MISTRAL_URL, MISTRAL_MODEL } from "./config.ts";
import { buildSystemPrompt, type VisitorLayer } from "./geologistPrompts.ts";

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

/** One call to the upstream model. The feedback of a previous
 * refusal travels with the instruction — the correction happens in
 * the model's own writing, the verdict vocabulary speaks to it. */
export async function generateLayer({
  instruction,
  feedback,
  visitorLayers,
}: {
  instruction: string;
  feedback: string | null;
  visitorLayers: VisitorLayer[];
}): Promise<{ statusCode: number; body: string }> {
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
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt({ visitorLayers }) },
          {
            role: "user",
            content: feedback === null ? instruction : instruction + "\n\n" + feedback,
          },
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
      body: "amont a répondu " + upstreamResponse.status + " (" + MISTRAL_MODEL + ") : " + detail,
    });
  }
  const data = (await upstreamResponse.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const proposal = extractProposalContent({ content: data?.choices?.[0]?.message?.content });
  if (!proposal.trim()) {
    throw new PenInfraFailure({ statusCode: 502, body: "le géologue n'a rien écrit" });
  }
  return { statusCode: 200, body: proposal };
}
