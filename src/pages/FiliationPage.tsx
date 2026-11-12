// The filiation page — the history of the idea and the comparison
// with the existing systems. The tutorial says how layered data
// works; this page says where it comes from (frames, defaults,
// object languages, the cascade, product lines, the configuration
// languages, the modeling stacks) and what it borrows, echoes or
// refuses — for the honesty of the story, not for the comfort of a
// name. Two axes read the neighbors, a table measures them, and the
// last section displays what the workshop adds and what it does not.
// The companion document is docs/filiation.md, in the repository.

import { useRouter } from "../components/Router";
import { say } from "../presentation/i18n.ts";
import { NotionText } from "../presentation/notions.tsx";
import type { BilingualText } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface FiliationPageProps {
  language: Language;
  onChooseLanguage: (lang: Language) => void;
}

/** One era of the history: the years, the name, and what it laid
 * down — bilingual throughout. */
interface FiliationEra {
  years: string;
  title: BilingualText;
  text: BilingualText;
}

const FILIATION_ERAS: FiliationEra[] = [
  {
    years: "1974–1985",
    title: { en: "Frames and semantic networks"},
    text: {
      en: "Minsky's frames (1974), then the typed semantic networks of KL-ONE (Brachman & Schmolze, 1985), lay down the whole gesture: linked concepts, slots carried by default, a read that walks the network when the local value is missing. The first-wins core sample is a frames semantics made total.",
    },
  },
  {
    years: "1980–1991",
    title: {
      en: "Defaults and non-monotonic reasoning",
    },
    text: {
      en: "Reiter's default logic (1980), McCarthy's circumscription (1980), Touretzky's mathematics of inheritance (1986), Brewka's tour (1991): reasoning that revises itself, and the specificity debate — which of two inherited values should win. The workshop answers with data: the order is the layer's refines list, not an engine heuristic.",
    },
  },
  {
    years: "1987–2003",
    title: { en: "Objects that compose"},
    text: {
      en: "Self's prototypes (Ungar & Smith, 1987) erase the class: objects delegate to objects. CLOS (Bobrow et al., 1988) pays the multiple-inheritance diamond and settles it by computed linearization; mixins (Bracha & Cook, 1990) and traits (Schärli et al., 2003) refine the granularity; the metaobject protocol (1991) opens the engine itself as data. Same gesture, other discipline: here the order is laid in the data, and a conflict is refused.",
    },
  },
  {
    years: "1994–1996",
    title: { en: "The cascade on the web"},
    text: {
      en: "Cascading Style Sheets (Lie's proposal, 1994; the W3C recommendation, 1996) merge declarations by origin, specificity and source order — a default inheritance over properties, for every page of the web. The proof that ordered override scales. The difference: the cascade's rules live coded in each browser; here the order lives in the data, and one measured operation reads it.",
    },
  },
  {
    years: "1990–2003",
    title: { en: "Features and product lines"},
    text: {
      en: "FODA (Kang et al., 1990) lays variability as data: features in a tree, AND/OR groups, cardinalities. Generative programming (Czarnecki & Eisenecker, 2000) and step-wise refinement (Batory et al., 2003) formalize the composition. The 2016 paper already read feature models as strata; the base loads automata, Kahn networks and Petri nets the same way.",
    },
  },
  {
    years: "2004–2017",
    title: { en: "The semantic web's stack"},
    text: {
      en: "RDF: everything is a triple, and the schema lives in the same space as the data — the classes are resources. OWL 2 (2012) layers the reasoning; SHACL (2017) puts constraints as data — the closest gesture to the workshop's checks. The difference: the open world, the commutative semantics, no strict first-wins on a path — and the workshop infers nothing.",
    },
  },
  {
    years: "2002–2010",
    title: {
      en: "The modeling tower and its dissidents",
    },
    text: {
      en: "MOF (ISO/IEC 19502, 2002), UML, EMF/Ecore: four ontological floors (M0–M3), instantiation the only crossing, conformance instead of refinement. The field dug under the wall — multilevel modeling: deep instantiation and potency (Atkinson & Kühne), clabjects, MetaDepth (de Lara & Guerra, 2010). The continuum removes the floors instead of relaxing them — and keeps the ordered merge the others lack.",
    },
  },
  {
    years: "2014–2019",
    title: { en: "The configuration languages"},
    text: {
      en: "Jsonnet (2014) already thinks its object as a stack of layers — A + B, self late-bound. Kustomize (2017) makes the overlay the industrial gesture. CUE (2019, out of Google's GCL) chooses the other semantics: a single lattice, associative, commutative, idempotent — a conflict refuses. Layered data keeps the GCL bet — ordered override — and answers GCL's documented complexity by measurement: order conflicts are refused in strict staging, and the price is displayed.",
    },
  },
  {
    years: "2016",
    title: { en: "The paper"},
    text: {
      en: "Layered Data: A Modular Formal Definition without Formalisms (Linard, Barbot, Buchs, Colange, Démoulins, Hillah, Martin — PNSE'16, CEUR Vol-1591): no new formalism, one datum operation. Formalisms and models are layered data; the closure and first-wins read them; unions, masks, citations and late binding compose them.",
    },
  },
  {
    years: "2024–2026",
    title: { en: "This workshop"},
    text: {
      en: "The idea made executable: 47 layers shipped as .ld files read by one kernel, a specification verified by property, contracts replayed at every assembly, a staged assisted-writing protocol — and every number cited on this site measured by a standalone harness.",
    },
  },
];

/** One row of the side-by-side table: the system, its merge, its
 * floors, and where it diverges from layered data. */
interface ComparisonRow {
  system: string;
  merge: BilingualText;
  floors: BilingualText;
  diverges: BilingualText;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    system: "CSS cascade",
    merge: {
      en: "ordered — origin, specificity, source order",
    },
    floors: { en: "none — properties only"},
    diverges: {
      en: "the cascade's rules are coded in each browser; here the order lives in the data, and one measured operation reads it",
    },
  },
  {
    system: "Jsonnet",
    merge: { en: "ordered — A + B, +:, super"},
    floors: { en: "none — values only"},
    diverges: {
      en: "a second merge semantics with explicit operators; here the merge is the read itself",
    },
  },
  {
    system: "Kustomize",
    merge: {
      en: "ordered — strategic-merge patches",
    },
    floors: { en: "none — resources only"},
    diverges: {
      en: "the same gesture at industrial scale, without a theory",
    },
  },
  {
    system: "CUE",
    merge: {
      en: "commutative — unification, idempotent",
    },
    floors: {
      en: "eroded — one lattice for types and values",
    },
    diverges: {
      en: "a conflict refuses; here the refines order decides, and strict staging refuses the conflicts",
    },
  },
  {
    system: "RDF / OWL 2",
    merge: {
      en: "commutative — open world, layered inference",
    },
    floors: {
      en: "eroded — punning, classes as resources",
    },
    diverges: {
      en: "the workshop infers nothing: strict addresses, total deterministic read",
    },
  },
  {
    system: "SHACL",
    merge: { en: "none — a validation pass"},
    floors: { en: "shapes beside the data"},
    diverges: {
      en: "a dedicated validation language, read by a validator; here the constraint is carried by the data, and validation is a read",
    },
  },
  {
    system: "MOF / EMF",
    merge: { en: "none — conformance"},
    floors: { en: "fixed — M0 to M3"},
    diverges: {
      en: "the workshop removes the floors: to instance is to cite, and the border between declaration and content is an addressing convention",
    },
  },
  {
    system: "Multilevel modeling",
    merge: { en: "varies"},
    floors: {
      en: "relaxed — deep instantiation, potency, clabjects",
    },
    diverges: {
      en: "these works soften the tower; the continuum removes it — and the discipline of levels they keep is a check layered data has yet to earn",
    },
  },
  {
    system: "CLOS / mixins / traits",
    merge: {
      en: "ordered — computed linearization, or symmetric composition",
    },
    floors: { en: "fixed — classes and instances"},
    diverges: {
      en: "the engine computes the order; here the data lays it, and a conflict between incomparable sources is refused",
    },
  },
  {
    system: "Self",
    merge: { en: "delegation — per message send"},
    floors: { en: "none — objects only"},
    diverges: {
      en: "the lookup is computed at send time; here the read is deterministic over an immutable space",
    },
  },
];

/** What the workshop adds — measured — and what it does not, said
 * aloud. */
const WORKSHOP_ADDS: BilingualText[] = [
  {
    en: "One writing, one reading. Schema, instance, constraint and rendering are layers; closure then first-wins reads them all with the same operation, from formalism to datum.",
  },
  {
    en: "Order as structure. The inheritance conflict is settled by the data — the refines list — never by the engine; the refusal of conflicts is measured.",
  },
  {
    en: "A normative specification verified by property. The obligations and conformances of docs/specification.md are replayed as measures by the harness — conformance measured, not theorems.",
  },
  {
    en: "Contracts carried by the data. Checks travel in the layers, the registry is itself a layer, the bedrock is read-only by protocol — verification is data, not code.",
  },
  {
    en: "An assisted-writing protocol. The geologist proposes, staging judges: the proposal is a staged layer, never a truth, and the refusal is spoken.",
  },
  {
    en: "Everything is data. The 47 layers of the base are .ld files read by the same kernel as the visitors' layers — the metamodel does not write itself here: it loads.",
  },
];

const WORKSHOP_LIMITS: BilingualText[] = [
  {
    en: "It does not infer. No subsumption, no open world, no satisfiability — what the description logics do, the workshop does not attempt.",
  },
  {
    en: "It has no OCL. The constraints are generic checks carried by the data — measured, composed, less expressive than a full constraint logic.",
  },
  {
    en: "It has no ecosystem. EMF has twenty years of tools and industry adoption; the workshop has seven harnesses and a tutorial.",
  },
  {
    en: "It pays displayed prices. The alias multiplies the reports of one defect, the linter is blind to designations by keys.",
  },
  {
    en: "No external evaluation yet. The corpus is its own; the honest gap — importing an external corpus (PNML nets, for instance) and measuring the idea against it — is the next step, and it is not taken yet.",
  },
];

/** The linked references: the label is bilingual, the target a URL. */
interface LinkReference {
  label: BilingualText;
  url: string;
}

const LINKED_REFERENCES: LinkReference[] = [
  {
    label: {
      en: "The founding paper — PNSE'16 proceedings (CEUR Vol-1591, open access)",
    },
    url: "https://ceur-ws.org/Vol-1591/",
  },
  {
    label: {
      en: "The archived version of the paper (HAL)",
    },
    url: "https://hal.sorbonne-universite.fr/hal-01353944",
  },
  {
    label: {
      en: "The companion document — docs/filiation.md in the repository",
    },
    url: "https://github.com/saucisson/layered-data/blob/feat/tutorial-page-defilante/docs/filiation.md",
  },
  {
    label: { en: "CUE — the introduction"},
    url: "https://cuelang.org/docs/introduction/",
  },
  {
    label: { en: "Jsonnet — the language reference"},
    url: "https://jsonnet.org/ref/language.html",
  },
  {
    label: {
      en: "Kustomize — the declarative customization of Kubernetes objects",
    },
    url: "https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/",
  },
  {
    label: { en: "OWL 2 — the W3C primer"},
    url: "https://www.w3.org/TR/owl2-primer/",
  },
  {
    label: { en: "SHACL — the W3C recommendation"},
    url: "https://www.w3.org/TR/shacl/",
  },
  {
    label: { en: "MetaDepth (de Lara & Guerra)"},
    url: "https://metadepth.org/",
  },
  {
    label: {
      en: "Multilevel modeling — the SoSyM playground survey",
    },
    url: "https://link.springer.com/article/10.1007/s10270-021-00900-2",
  },
  {
    label: {
      en: "PNML — the Petri Net Markup Language",
    },
    url: "https://www.pnml.org/",
  },
];

const PRINTED_REFERENCES: string[] = [
  "Minsky, A Framework for Representing Knowledge, 1974",
  "Brachman & Schmolze, An Overview of the KL-ONE Knowledge Representation Language, 1985",
  "Reiter, A Logic for Default Reasoning, 1980",
  "McCarthy, Circumscription — A Form of Non-Monotonic Reasoning, 1980",
  "Touretzky, The Mathematics of Inheritance Systems, 1986",
  "Brewka, Nonmonotonic Reasoning, 1991",
  "Ungar & Smith, Self: The Power of Simplicity, 1987",
  "Bobrow, Gabriel, Keene & Kiczales, Common Lisp Object System Specification, 1988",
  "Bracha & Cook, Mixin-Based Inheritance, 1990",
  "Kiczales, des Rivières & Bobrow, The Art of the Metaobject Protocol, 1991",
  "Schärli, Ducasse, Nierstrasz & Black, Traits: Composable Units of Behaviour, 2003",
  "Kang et al., Feature-Oriented Domain Analysis (FODA), 1990",
  "Czarnecki & Eisenecker, Generative Programming, 2000",
  "Batory, Sarvela & Rauschmayer, Scaling Step-Wise Refinement, 2003",
  "Atkinson & Kühne, The Essence of Multilevel Metamodeling, 2001",
  "de Lara & Guerra, Deep Meta-Modelling with MetaDepth, 2010",
  "Lieberman, Cascading Style Sheets, a proposal, 1994",
];

export function FiliationPage({ language, onChooseLanguage }: FiliationPageProps) {
  const { navigate } = useRouter();

  const cell = (text: BilingualText) => say({ language, en: text.en});

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-4">
            <button type="button"
              onClick={() => navigate("landing")}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-900"
            >
              {say({ language, en: "← Back"})}
            </button>
            <h1 className="text-lg font-bold">
              {say({
                language,
                en: "Filiation — history and comparison",
              })}
            </h1>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-600">
              {say({ language, en: "language: "})}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button type="button"
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 p-4 sm:p-8">
        <section>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            <NotionText
              text={say({
                language,
                en: "This idea did not fall from the sky. Layered data is the latest stratum of a long sediment: knowledge representation, object languages, the style sheets of the web, product lines, configuration languages, modeling stacks. This page walks that lineage — for the honesty of the story, not for the comfort of a name — then measures the differences: two axes read the neighbors, a table compares them side by side, and the last section says what the workshop adds and what it does not — the tutorial explains the gesture, this page names the ancestors. The companion document is docs/filiation.md, in the repository.",
              })}
              language={language}
            />
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "1 · A history of the gesture"})}
          </h2>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            {say({
              language,
              en: "ten eras, one gesture: linked things, values carried by default, a read that walks the chain when the local value is missing",
            })}
          </p>
          <ol className="space-y-4">
            {FILIATION_ERAS.map((era) => (
              <li key={era.years} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                    {era.years}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{cell(era.title)}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  <NotionText text={cell(era.text)} language={language} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "2 · Two axes to read the existing",
            })}
          </h2>
          <p className="mb-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
            <NotionText
              text={say({
                language,
                en: "Ask two questions of every system on this page. How do the strata merge: by ordered override — an order decides, the first that speaks wins — or by commutative unification — the merge is order-free, a conflict refuses? And how many ontological floors: fixed levels — a wall between the schema and the data, instantiation the only crossing — or a ⟪continuum⟫, where formalisms and models are the same kind of thing? The grid below places the neighbors; it is a lamp, not a verdict — Jsonnet and Kustomize carry no ontology at all (their merge is about values), and MOF/EMF stands outside the grid: floors without merge.",
              })}
              language={language}
            />
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-xs leading-5">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-left text-slate-500">
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "floors ↓ / merge →"})}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({
                      language,
                      en: "ordered override — the first that speaks wins",
                    })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({
                      language,
                      en: "commutative unification — a conflict refuses",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left align-top font-semibold text-slate-600">
                    {say({ language, en: "fixed levels"})}
                  </th>
                  <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                    {say({
                      language,
                      en: "Kustomize overlays, Jsonnet's A + B — configuration values, the types elsewhere",
                    })}
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                    {say({
                      language,
                      en: "OWL 2 / RDF — the open-world knowledge stack",
                    })}
                  </td>
                </tr>
                <tr>
                  <th className="px-3 py-2 text-left align-top font-semibold text-slate-600">
                    {say({ language, en: "continuum"})}
                  </th>
                  <td className="rounded bg-sky-50 px-3 py-2 align-top font-semibold text-sky-800">
                    {say({
                      language,
                      en: "layered data — this workshop",
                    })}
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                    {say({
                      language,
                      en: "CUE — one lattice for types and values",
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            {say({
              language,
              en: "Layered data sits in a corner few systems occupy: the ordered merge of CSS, applied to a continuum of formalisms and models. The price of that corner — order is meaning — is paid openly on this page's last section.",
            })}
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "3 · The neighbors, side by side",
            })}
          </h2>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            {say({
              language,
              en: "one row per neighbor: how it merges, how many floors it keeps, and where it diverges from layered data",
            })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-xs leading-5">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-left text-slate-500">
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "system"})}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "the merge"})}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "the floors"})}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "where it diverges"})}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.system} className="border-b border-slate-100 align-top">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                      {row.system}
                    </th>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{cell(row.merge)}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{cell(row.floors)}</td>
                    <td className="px-3 py-2 text-slate-600">{cell(row.diverges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({
              language,
              en: "4 · What the workshop adds — and what it does not",
            })}
          </h2>
          <div className="mt-4 grid gap-4 sm:p-6 md:grid-cols-2">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-sky-800">
                {say({ language, en: "What it adds, measured"})}
              </h3>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {WORKSHOP_ADDS.map((item) => (
                  <li key={item.en}>{cell(item)}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-rose-800">
                {say({
                  language,
                  en: "What it does not — and says so",
                })}
              </h3>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {WORKSHOP_LIMITS.map((item) => (
                  <li key={item.en}>{cell(item)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
            {say({ language, en: "5 · The references"})}
          </h2>
          <ul className="mt-2 space-y-1 text-sm leading-6">
            {LINKED_REFERENCES.map((reference) => (
              <li key={reference.url}>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 underline decoration-dotted hover:text-sky-900"
                >
                  {cell(reference.label)}
                </a>
              </li>
            ))}
          </ul>
          <details className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">
              {say({ language, en: "the printed references"})}
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-slate-600">
              {PRINTED_REFERENCES.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          </details>
        </section>

        <div className="flex justify-center gap-4 pt-4">
          <button type="button"
            onClick={() => navigate("landing")}
            className="rounded-lg border-2 border-slate-300 dark:border-slate-600 px-6 py-3 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:bg-slate-900 transition-colors"
          >
            {say({ language, en: "← Landing"})}
          </button>
          <button type="button"
            onClick={() => navigate("tutorial")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
          >
            {say({ language, en: "Tutorial →"})}
          </button>
          <button type="button"
            onClick={() => navigate("workshop")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Workshop →"})}
          </button>
        </div>

        <footer className="border-t border-slate-200 dark:border-slate-700 pt-6 text-center text-xs text-slate-600">
          {say({
            language,
            en: "Layered Data — the filiation is part of the rigor: the story names its ancestors, the comparison measures its differences",
          })}
        </footer>
      </main>
    </div>
  );
}
