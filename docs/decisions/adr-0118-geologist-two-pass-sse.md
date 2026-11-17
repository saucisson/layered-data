# ADR-0118: The geologist in two passes — survey, then filtered proposal — with an SSE stream

- Status: proposed
- Date: 2026-11-14
- Issue: #279

## Context

`POST /api/generate` built one monolith system prompt per model call:
the manifesto, the full stratigraphic column (one header plus up to
four comment lines for each of the 85 kernel layers, plus the
visitors' layers), two complete examples and the visitors' full
sources — measured at 42 700 chars (~10 700 tokens), 77 % of it the
column alone. With `mistral-large-4` (thinking cannot be disabled)
a generation exceeded 280 s; the client aborted at 300 s and silently
fell back to the simulated proposal.

## Decision

The geologist runs in **two passes over one POST**:

1. **Survey (pass A)** — a fast non-reasoning model (`SURVEY_MODEL`,
   default `mistral-small-latest`, `SURVEY_MAX_TOKENS`=256) sees
   `buildSurveyPrompt`: the manifesto, the expected structure and the
   column cut to **one comment line per layer** (13 118 chars; the
   whole survey prompt measures 15 959). It answers either lines
   starting with `QUESTION:` (the `questions` event — no call to the
   main model happens) or `@names`, one per line. Names are validated
   against the living names (kernel + visitors read at the call) and
   **closed deterministically over their `refines` ancestors**
   (`parentsOf` parses the headers; the server adds the chain itself).
   An empty or unusable selection is a fallback, never an invented
   name.
2. **Proposal (pass B)** — the existing verified loop
   (`composeVerifiedLayerDraft`, unchanged, still the only gate) runs
   with a system prompt cut to the selection: the selected layers'
   full sources replace the two fixed examples, the column drops the
   selected layers, annotates the ancestors and lists every other
   layer as a bare name (11 511 chars for dag+kahn). Without a
   selection — or on a survey failure — the prompt is the monolith,
   byte-identical to before: the fallback is never worse.

With `Accept: text/event-stream`, the route streams one event per
step: `questions`, `selection` (`{ selected, closure, fallback }`),
`round`, `refusal`, `draft`, `refused`, `error`. Without the header,
the documented plain-text behavior (200 draft / 422 refusal / 5xx
infrastructure) is unchanged. The client reads the stream with an
**inactivity timeout** (120 s, reset at each event) plus a total cap,
instead of a total 300 s timeout. Both passes carry `max_tokens`
ceilings (`SURVEY_MAX_TOKENS`, `PEN_MAX_TOKENS`) and `prompt_cache_key`
(`layered-data-survey`, `layered-data-pen-<intention>`) so the shared
prefixes are cache hits. Answers to survey questions come back in a
new POST with `{ prompt, answers }`. One HTTP request = one rate-limit
count; the two passes are internal.

## Consequences

- The first concrete feedback (the chosen ground) reaches the client
  in seconds; the opaque 300 s wait disappears.
- The pen's prompt drops 49–71 % depending on the selection, which
  alone brings large-model generations well under the old timeout.
- The staging, the verdict vocabulary and the loop semantics are
  untouched: no proposal bypasses `composeVerifiedLayerDraft`.
- Without `MISTRAL_API_KEY` the behavior is unchanged (500 explicit,
  or an `error` event in stream mode).
