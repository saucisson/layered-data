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
    title: { en: "Frames and semantic networks", fr: "Frames et réseaux sémantiques" },
    text: {
      en: "Minsky's frames (1974), then the typed semantic networks of KL-ONE (Brachman & Schmolze, 1985), lay down the whole gesture: linked concepts, slots carried by default, a read that walks the network when the local value is missing. The first-wins core sample is a frames semantics made total.",
      fr: "Les frames de Minsky (1974), puis les réseaux sémantiques typés de KL-ONE (Brachman & Schmolze, 1985), posent tout le geste : des concepts reliés, des slots portés par défaut, une lecture qui descend le réseau quand la valeur locale manque. Le carottage premier-gagné est une sémantique de frames rendue totale.",
    },
  },
  {
    years: "1980–1991",
    title: {
      en: "Defaults and non-monotonic reasoning",
      fr: "Défauts et raisonnement non monotone",
    },
    text: {
      en: "Reiter's default logic (1980), McCarthy's circumscription (1980), Touretzky's mathematics of inheritance (1986), Brewka's tour (1991): reasoning that revises itself, and the specificity debate — which of two inherited values should win. The workshop answers with data: the order is the layer's refines list, not an engine heuristic.",
      fr: "La logique des défauts de Reiter (1980), la circonscription de McCarthy (1980), les mathématiques de l'héritage de Touretzky (1986), le tour de Brewka (1991) : un raisonnement qui se rétracte, et le débat de la spécificité — laquelle de deux valeurs héritées doit gagner. L'atelier répond par la donnée : l'ordre est la liste refines de la couche, pas une heuristique du moteur.",
    },
  },
  {
    years: "1987–2003",
    title: { en: "Objects that compose", fr: "Les objets qui composent" },
    text: {
      en: "Self's prototypes (Ungar & Smith, 1987) erase the class: objects delegate to objects. CLOS (Bobrow et al., 1988) pays the multiple-inheritance diamond and settles it by computed linearization; mixins (Bracha & Cook, 1990) and traits (Schärli et al., 2003) refine the granularity; the metaobject protocol (1991) opens the engine itself as data. Same gesture, other discipline: here the order is laid in the data, and a conflict is refused.",
      fr: "Les prototypes de Self (Ungar & Smith, 1987) effacent la classe : des objets délèguent à des objets. Le CLOS (Bobrow et al., 1988) paie le diamant de l'héritage multiple et le solde par la linéarisation calculée ; les mixins (Bracha & Cook, 1990) et les traits (Schärli et al., 2003) en font la granularité ; le protocole à méta-objets (1991) ouvre le moteur lui-même comme donnée. Même geste, autre discipline : ici l'ordre est posé dans la donnée, et un conflit est refusé.",
    },
  },
  {
    years: "1994–1996",
    title: { en: "The cascade on the web", fr: "La cascade du web" },
    text: {
      en: "Cascading Style Sheets (Lie's proposal, 1994; the W3C recommendation, 1996) merge declarations by origin, specificity and source order — a default inheritance over properties, for every page of the web. The proof that ordered override scales. The difference: the cascade's rules live coded in each browser; here the order lives in the data, and one measured operation reads it.",
      fr: "Les feuilles de style en cascade (la proposition de Lie, 1994 ; la recommandation du W3C, 1996) fusionnent des déclarations par origine, spécificité et ordre de source — un héritage par défaut sur des propriétés, pour toutes les pages du web. La preuve que la surcharge ordonnée passe à l'échelle. La différence : les règles de la cascade vivent codées dans chaque navigateur ; ici l'ordre vit dans la donnée, et une seule opération mesurée la lit.",
    },
  },
  {
    years: "1990–2003",
    title: { en: "Features and product lines", fr: "Features et lignes de produits" },
    text: {
      en: "FODA (Kang et al., 1990) lays variability as data: features in a tree, AND/OR groups, cardinalities. Generative programming (Czarnecki & Eisenecker, 2000) and step-wise refinement (Batory et al., 2003) formalize the composition. The 2016 paper already read feature models as strata; the base loads automata, Kahn networks and Petri nets the same way.",
      fr: "FODA (Kang et al., 1990) pose la variabilité comme donnée : des features en arbre, des groupes ET/OU, des cardinalités. La programmation générative (Czarnecki & Eisenecker, 2000) et le raffinement par étapes (Batory et al., 2003) en formalisent la composition. Le papier de 2016 lisait déjà les feature models comme des strates ; le socle charge de la même façon les automates, les réseaux de Kahn et les réseaux de Petri.",
    },
  },
  {
    years: "2004–2017",
    title: { en: "The semantic web's stack", fr: "La pile du web sémantique" },
    text: {
      en: "RDF: everything is a triple, and the schema lives in the same space as the data — the classes are resources. OWL 2 (2012) layers the reasoning; SHACL (2017) puts constraints as data — the closest gesture to the workshop's checks. The difference: the open world, the commutative semantics, no strict first-wins on a path — and the workshop infers nothing.",
      fr: "RDF : tout est triplet, et le schéma vit dans le même espace que la donnée — les classes sont des ressources. OWL 2 (2012) superpose le raisonnement ; SHACL (2017) pose les contraintes comme des données — le geste le plus proche des checks de l'atelier. La différence : le monde ouvert, la sémantique commutative, pas de premier-gagné strict sur un chemin — et l'atelier n'infère rien.",
    },
  },
  {
    years: "2002–2010",
    title: {
      en: "The modeling tower and its dissidents",
      fr: "La tour de modélisation et ses dissidents",
    },
    text: {
      en: "MOF (ISO/IEC 19502, 2002), UML, EMF/Ecore: four ontological floors (M0–M3), instantiation the only crossing, conformance instead of refinement. The field dug under the wall — multilevel modeling: deep instantiation and potency (Atkinson & Kühne), clabjects, MetaDepth (de Lara & Guerra, 2010). The continuum removes the floors instead of relaxing them — and keeps the ordered merge the others lack.",
      fr: "MOF (ISO/IEC 19502, 2002), UML, EMF/Ecore : quatre étages ontologiques (M0–M3), l'instanciation pour seul franchissement, la conformité au lieu du raffinement. Le terrain a creusé sous le mur — la modélisation multi-niveaux : l'instantiation profonde et la potency (Atkinson & Kühne), les clabjects, MetaDepth (de Lara & Guerra, 2010). Le continuum supprime les étages au lieu de les assouplir — et garde la fusion ordonnée qui manque aux autres.",
    },
  },
  {
    years: "2014–2019",
    title: { en: "The configuration languages", fr: "Les langages de configuration" },
    text: {
      en: "Jsonnet (2014) already thinks its object as a stack of layers — A + B, self late-bound. Kustomize (2017) makes the overlay the industrial gesture. CUE (2019, out of Google's GCL) chooses the other semantics: a single lattice, associative, commutative, idempotent — a conflict refuses. Layered data keeps the GCL bet — ordered override — and answers GCL's documented complexity by measurement: order conflicts are refused in strict staging, and the price is displayed.",
      fr: "Jsonnet (2014) pense déjà son objet comme une pile de couches — A + B, self à liaison tardive. Kustomize (2017) fait de la surcouche le geste industriel. CUE (2019, sorti de la GCL de Google) choisit l'autre sémantique : un treillis unique, associatif, commutatif, idempotent — un conflit refuse. Les layered data gardent le pari de GCL — la surcharge ordonnée — et répondent à la complexité documentée de GCL par la mesure : les conflits d'ordre sont refusés en staging strict, et le prix est affiché.",
    },
  },
  {
    years: "2016",
    title: { en: "The paper", fr: "Le papier" },
    text: {
      en: "Layered Data: A Modular Formal Definition without Formalisms (Linard, Barbot, Buchs, Colange, Démoulins, Hillah, Martin — PNSE'16, CEUR Vol-1591): no new formalism, one datum operation. Formalisms and models are layered data; the closure and first-wins read them; unions, masks, citations and late binding compose them.",
      fr: "Layered Data: A Modular Formal Definition without Formalisms (Linard, Barbot, Buchs, Colange, Démoulins, Hillah, Martin — PNSE'16, CEUR Vol-1591) : pas de nouveau formalisme, une opération de donnée. Formalismes et modèles sont des layered data ; la fermeture et le premier-gagné les lisent ; unions, masques, citations et liaison tardive les composent.",
    },
  },
  {
    years: "2024–2026",
    title: { en: "This workshop", fr: "Cet atelier" },
    text: {
      en: "The idea made executable: 47 layers shipped as .ld files read by one kernel, a specification verified by property, contracts replayed at every assembly, a staged assisted-writing protocol — and every number cited on this site measured by a standalone harness.",
      fr: "L'idée rendue exécutable : 47 couches livrées en fichiers .ld lus par un seul noyau, une spécification vérifiée par propriété, des contrats rejoués à chaque assemblage, un protocole d'écriture assistée stagé — et chaque chiffre cité sur ce site mesuré par un harnais autonome.",
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
      fr: "ordonnée — origine, spécificité, ordre de source",
    },
    floors: { en: "none — properties only", fr: "aucun — des propriétés seulement" },
    diverges: {
      en: "the cascade's rules are coded in each browser; here the order lives in the data, and one measured operation reads it",
      fr: "les règles de la cascade sont codées dans chaque navigateur ; ici l'ordre vit dans la donnée, et une seule opération mesurée la lit",
    },
  },
  {
    system: "Jsonnet",
    merge: { en: "ordered — A + B, +:, super", fr: "ordonnée — A + B, +:, super" },
    floors: { en: "none — values only", fr: "aucun — des valeurs seulement" },
    diverges: {
      en: "a second merge semantics with explicit operators; here the merge is the read itself",
      fr: "une seconde sémantique de fusion, à opérateurs explicites ; ici la fusion est la lecture elle-même",
    },
  },
  {
    system: "Kustomize",
    merge: {
      en: "ordered — strategic-merge patches",
      fr: "ordonnée — des patchs à fusion stratégique",
    },
    floors: { en: "none — resources only", fr: "aucun — des ressources seulement" },
    diverges: {
      en: "the same gesture at industrial scale, without a theory",
      fr: "le même geste à l'échelle industrielle, sans théorie",
    },
  },
  {
    system: "CUE",
    merge: {
      en: "commutative — unification, idempotent",
      fr: "commutative — unification, idempotente",
    },
    floors: {
      en: "eroded — one lattice for types and values",
      fr: "érodés — un seul treillis pour types et valeurs",
    },
    diverges: {
      en: "a conflict refuses; here the refines order decides, and strict staging refuses the conflicts",
      fr: "un conflit refuse ; ici l'ordre des refines décide, et le staging strict refuse les conflits",
    },
  },
  {
    system: "RDF / OWL 2",
    merge: {
      en: "commutative — open world, layered inference",
      fr: "commutative — monde ouvert, inférence en couches",
    },
    floors: {
      en: "eroded — punning, classes as resources",
      fr: "érodés — punning, les classes comme ressources",
    },
    diverges: {
      en: "the workshop infers nothing: strict addresses, total deterministic read",
      fr: "l'atelier n'infère rien : adresses strictes, lecture déterministe totale",
    },
  },
  {
    system: "SHACL",
    merge: { en: "none — a validation pass", fr: "aucune — une passe de validation" },
    floors: { en: "shapes beside the data", fr: "des shapes à côté de la donnée" },
    diverges: {
      en: "a dedicated validation language, read by a validator; here the constraint is carried by the data, and validation is a read",
      fr: "un langage de validation dédié, lu par un validateur ; ici la contrainte est portée par la donnée, et la validation est une lecture",
    },
  },
  {
    system: "MOF / EMF",
    merge: { en: "none — conformance", fr: "aucune — conformité" },
    floors: { en: "fixed — M0 to M3", fr: "fixes — de M0 à M3" },
    diverges: {
      en: "the workshop removes the floors: to instance is to cite, and the border between declaration and content is an addressing convention",
      fr: "l'atelier supprime les étages : instancier, c'est citer ; la frontière entre déclaration et contenu est une convention d'adressage",
    },
  },
  {
    system: "Multilevel modeling",
    merge: { en: "varies", fr: "variable" },
    floors: {
      en: "relaxed — deep instantiation, potency, clabjects",
      fr: "assouplis — instantiation profonde, potency, clabjects",
    },
    diverges: {
      en: "these works soften the tower; the continuum removes it — and the discipline of levels they keep is a check layered data has yet to earn",
      fr: "ces travaux assouplissent la tour ; le continuum la supprime — et la discipline de niveaux qu'ils gardent est un contrôle que les layered data n'ont pas encore gagné",
    },
  },
  {
    system: "CLOS / mixins / traits",
    merge: {
      en: "ordered — computed linearization, or symmetric composition",
      fr: "ordonnée — linéarisation calculée, ou composition symétrique",
    },
    floors: { en: "fixed — classes and instances", fr: "fixes — classes et instances" },
    diverges: {
      en: "the engine computes the order; here the data lays it, and a conflict between incomparable sources is refused",
      fr: "le moteur calcule l'ordre ; ici la donnée le pose, et un conflit entre sources incomparables est refusé",
    },
  },
  {
    system: "Self",
    merge: { en: "delegation — per message send", fr: "délégation — à chaque envoi de message" },
    floors: { en: "none — objects only", fr: "aucun — des objets seulement" },
    diverges: {
      en: "the lookup is computed at send time; here the read is deterministic over an immutable space",
      fr: "le lookup se calcule à chaque envoi ; ici la lecture est déterministe sur un espace immuable",
    },
  },
];

/** What the workshop adds — measured — and what it does not, said
 * aloud. */
const WORKSHOP_ADDS: BilingualText[] = [
  {
    en: "One writing, one reading. Schema, instance, constraint and rendering are layers; closure then first-wins reads them all with the same operation, from formalism to datum.",
    fr: "Une seule écriture, une seule lecture. Schéma, instance, contrainte et rendu sont des couches ; la fermeture puis le premier-gagné les lisent avec la même opération, du formalisme à la donnée.",
  },
  {
    en: "Order as structure. The inheritance conflict is settled by the data — the refines list — never by the engine; the refusal of conflicts is measured.",
    fr: "L'ordre comme structure. Le conflit d'héritage est tranché par la donnée — la liste refines — jamais par le moteur ; le refus des conflits est mesuré.",
  },
  {
    en: "A normative specification verified by property. The obligations and conformances of docs/specification.md are replayed as measures by the harness — conformance measured, not theorems.",
    fr: "Une spécification normative vérifiée par propriété. Les obligations et conformances de docs/specification.md sont rejouées comme des mesures par le harnais — des conformances mesurées, pas des théorèmes.",
  },
  {
    en: "Contracts carried by the data. Checks travel in the layers, the registry is itself a layer, the bedrock is read-only by protocol — verification is data, not code.",
    fr: "Des contrats portés par les données. Les checks voyagent dans les couches, le registre est lui-même une couche, le socle est immuable par protocole — la vérification est de la donnée, pas du code.",
  },
  {
    en: "An assisted-writing protocol. The geologist proposes, staging judges: the proposal is a staged layer, never a truth, and the refusal is spoken.",
    fr: "Un protocole d'écriture assistée. Le géologue propose, le staging juge : la proposition est une couche stagée, jamais une vérité, et le refus est parlé.",
  },
  {
    en: "Everything is data. The 47 layers of the base are .ld files read by the same kernel as the visitors' layers — the metamodel does not write itself here: it loads.",
    fr: "Tout est donnée. Les 47 couches du socle sont des fichiers .ld lus par le même noyau que les couches des visiteurs — le métamodèle ne s'écrit pas ici : il se charge.",
  },
];

const WORKSHOP_LIMITS: BilingualText[] = [
  {
    en: "It does not infer. No subsumption, no open world, no satisfiability — what the description logics do, the workshop does not attempt.",
    fr: "Il n'infère pas. Ni subsumption, ni monde ouvert, ni satisfiabilité — ce que font les logiques de description, l'atelier ne le tente pas.",
  },
  {
    en: "It has no OCL. The constraints are generic checks carried by the data — measured, composed, less expressive than a full constraint logic.",
    fr: "Il n'a pas d'OCL. Les contraintes sont des checks génériques portés par les données — mesurés, composés, moins expressifs qu'une logique de contraintes complète.",
  },
  {
    en: "It has no ecosystem. EMF has twenty years of tools and industry adoption; the workshop has seven harnesses and a tutorial.",
    fr: "Il n'a pas d'écosystème. EMF a vingt ans d'outils et l'adoption de l'industrie ; l'atelier a sept harnais et un tutoriel.",
  },
  {
    en: "It pays displayed prices. The alias multiplies the reports of one defect, the linter is blind to designations by keys.",
    fr: "Il paie des prix affichés. L'alias multiplie les signalements d'un même défaut, le linter est aveugle aux désignations par clés.",
  },
  {
    en: "No external evaluation yet. The corpus is its own; the honest gap — importing an external corpus (PNML nets, for instance) and measuring the idea against it — is the next step, and it is not taken yet.",
    fr: "Pas encore d'évaluation externe. Le corpus est le sien ; la brèche honnête — importer un corpus externe (des réseaux PNML, par exemple) et mesurer l'idée contre lui — est l'étape suivante, et elle n'est pas encore franchie.",
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
      fr: "Le papier fondateur — actes de PNSE'16 (CEUR Vol-1591, en accès libre)",
    },
    url: "https://ceur-ws.org/Vol-1591/",
  },
  {
    label: {
      en: "The archived version of the paper (HAL)",
      fr: "La version archivée du papier (HAL)",
    },
    url: "https://hal.sorbonne-universite.fr/hal-01353944",
  },
  {
    label: {
      en: "The companion document — docs/filiation.md in the repository",
      fr: "Le document compagnon — docs/filiation.md dans le dépôt",
    },
    url: "https://github.com/saucisson/layered-data/blob/feat/tutorial-page-defilante/docs/filiation.md",
  },
  {
    label: { en: "CUE — the introduction", fr: "CUE — l'introduction" },
    url: "https://cuelang.org/docs/introduction/",
  },
  {
    label: { en: "Jsonnet — the language reference", fr: "Jsonnet — la référence du langage" },
    url: "https://jsonnet.org/ref/language.html",
  },
  {
    label: {
      en: "Kustomize — the declarative customization of Kubernetes objects",
      fr: "Kustomize — la personnalisation déclarative des objets Kubernetes",
    },
    url: "https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/",
  },
  {
    label: { en: "OWL 2 — the W3C primer", fr: "OWL 2 — le primer du W3C" },
    url: "https://www.w3.org/TR/owl2-primer/",
  },
  {
    label: { en: "SHACL — the W3C recommendation", fr: "SHACL — la recommandation du W3C" },
    url: "https://www.w3.org/TR/shacl/",
  },
  {
    label: { en: "MetaDepth (de Lara & Guerra)", fr: "MetaDepth (de Lara & Guerra)" },
    url: "https://metadepth.org/",
  },
  {
    label: {
      en: "Multilevel modeling — the SoSyM playground survey",
      fr: "La modélisation multi-niveaux — le panorama SoSyM",
    },
    url: "https://link.springer.com/article/10.1007/s10270-021-00900-2",
  },
  {
    label: {
      en: "PNML — the Petri Net Markup Language",
      fr: "PNML — le Petri Net Markup Language",
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

  const cell = (text: BilingualText) => say({ language, en: text.en, fr: text.fr });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("landing")}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {say({ language, en: "← Back", fr: "← Retour" })}
            </button>
            <h1 className="text-lg font-bold">
              {say({
                language,
                en: "Filiation — history and comparison",
                fr: "Filiation — histoire et comparaison",
              })}
            </h1>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="mr-1 text-slate-400">
              {say({ language, en: "language: ", fr: "langue : " })}
            </span>
            {(["en", "fr"] as Language[]).map((choice) => (
              <button
                key={choice}
                onClick={() => onChooseLanguage(choice)}
                className={
                  "rounded border px-1.5 py-0.5 font-bold uppercase " +
                  (language === choice
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-300 bg-white text-slate-500 hover:border-slate-500")
                }
              >
                {choice}
              </button>
            ))}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 p-8">
        <section>
          <p className="text-sm leading-6 text-slate-700">
            <NotionText
              text={say({
                language,
                en: "This idea did not fall from the sky. Layered data is the latest stratum of a long sediment: knowledge representation, object languages, the style sheets of the web, product lines, configuration languages, modeling stacks. This page walks that lineage — for the honesty of the story, not for the comfort of a name — then measures the differences: two axes read the neighbors, a table compares them side by side, and the last section says what the workshop adds and what it does not — the tutorial explains the gesture, this page names the ancestors. The companion document is docs/filiation.md, in the repository.",
                fr: "Cette idée n'est pas tombée du ciel. Les layered data sont la strate la plus récente d'un long sédiment : la représentation des connaissances, les langages à objets, les feuilles de style du web, les lignes de produits, les langages de configuration, les tours de modélisation. Cette page parcourt cette filiation — pour l'honnêteté du récit, pas pour la caution d'un nom — puis mesure les différences : deux axes lisent les voisins, une table les compare côte à côte, et la dernière section dit ce que l'atelier ajoute et ce qu'il ne fait pas. Chaque époque de cette histoire fait écho à une notion du tutoriel — le tutoriel explique le geste, cette page nomme les ancêtres. Le document compagnon est docs/filiation.md, dans le dépôt.",
              })}
              language={language}
            />
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800">
            {say({ language, en: "1 · A history of the gesture", fr: "1 · Une histoire du geste" })}
          </h2>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            {say({
              language,
              en: "ten eras, one gesture: linked things, values carried by default, a read that walks the chain when the local value is missing",
              fr: "dix époques, un seul geste : des choses reliées, des valeurs portées par défaut, une lecture qui descend la chaîne quand la valeur locale manque",
            })}
          </p>
          <ol className="space-y-4">
            {FILIATION_ERAS.map((era) => (
              <li key={era.years} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">
                    {era.years}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">{cell(era.title)}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <NotionText text={cell(era.text)} language={language} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800">
            {say({
              language,
              en: "2 · Two axes to read the existing",
              fr: "2 · Deux axes pour lire l'existant",
            })}
          </h2>
          <p className="mb-4 text-sm leading-6 text-slate-700">
            <NotionText
              text={say({
                language,
                en: "Ask two questions of every system on this page. How do the strata merge: by ordered override — an order decides, the first that speaks wins — or by commutative unification — the merge is order-free, a conflict refuses? And how many ontological floors: fixed levels — a wall between the schema and the data, instantiation the only crossing — or a ⟪continuum⟫, where formalisms and models are the same kind of thing? The grid below places the neighbors; it is a lamp, not a verdict — Jsonnet and Kustomize carry no ontology at all (their merge is about values), and MOF/EMF stands outside the grid: floors without merge.",
                fr: "Posez deux questions à chaque système de cette page. Comment les strates fusionnent-elles : par surcharge ordonnée — un ordre décide, le premier qui parle gagne — ou par unification commutative — la fusion est sans ordre, un conflit refuse ? Et combien d'étages ontologiques : des niveaux fixes — un mur entre le schéma et la donnée, l'instanciation pour seul franchissement — ou un ⟪continuum⟫, où formalismes et modèles sont la même chose ? La grille ci-dessous place les voisins ; elle est une lampe, pas un verdict — Jsonnet et Kustomize ne portent aucune ontologie (leur fusion porte sur des valeurs), et MOF/EMF se tient hors de la grille : des étages sans fusion.",
              })}
              language={language}
            />
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs leading-5">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "floors ↓ / merge →", fr: "étages ↓ / fusion →" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({
                      language,
                      en: "ordered override — the first that speaks wins",
                      fr: "surcharge ordonnée — le premier qui parle gagne",
                    })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({
                      language,
                      en: "commutative unification — a conflict refuses",
                      fr: "unification commutative — un conflit refuse",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left align-top font-semibold text-slate-600">
                    {say({ language, en: "fixed levels", fr: "niveaux fixes" })}
                  </th>
                  <td className="px-3 py-2 align-top text-slate-700">
                    {say({
                      language,
                      en: "Kustomize overlays, Jsonnet's A + B — configuration values, the types elsewhere",
                      fr: "les surcouches Kustomize, le A + B de Jsonnet — des valeurs de configuration, les types ailleurs",
                    })}
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700">
                    {say({
                      language,
                      en: "OWL 2 / RDF — the open-world knowledge stack",
                      fr: "OWL 2 / RDF — la pile de connaissances à monde ouvert",
                    })}
                  </td>
                </tr>
                <tr>
                  <th className="px-3 py-2 text-left align-top font-semibold text-slate-600">
                    {say({ language, en: "continuum", fr: "continuum" })}
                  </th>
                  <td className="rounded bg-sky-50 px-3 py-2 align-top font-semibold text-sky-800">
                    {say({
                      language,
                      en: "layered data — this workshop",
                      fr: "les layered data — cet atelier",
                    })}
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700">
                    {say({
                      language,
                      en: "CUE — one lattice for types and values",
                      fr: "CUE — un seul treillis pour les types et les valeurs",
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
              fr: "Les layered data se tiennent dans un coin que peu de systèmes occupent : la fusion ordonnée de la CSS, appliquée à un continuum de formalismes et de modèles. Le prix de ce coin — l'ordre est un sens — se paie ouvertement dans la dernière section de cette page.",
            })}
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800">
            {say({
              language,
              en: "3 · The neighbors, side by side",
              fr: "3 · Les voisins, côte à côte",
            })}
          </h2>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            {say({
              language,
              en: "one row per neighbor: how it merges, how many floors it keeps, and where it diverges from layered data",
              fr: "une ligne par voisin : comment il fusionne, combien d'étages il garde, et où il diverge des layered data",
            })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-xs leading-5">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "system", fr: "système" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "the merge", fr: "la fusion" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "the floors", fr: "les étages" })}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {say({ language, en: "where it diverges", fr: "où il diverge" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.system} className="border-b border-slate-100 align-top">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      {row.system}
                    </th>
                    <td className="px-3 py-2 text-slate-700">{cell(row.merge)}</td>
                    <td className="px-3 py-2 text-slate-700">{cell(row.floors)}</td>
                    <td className="px-3 py-2 text-slate-600">{cell(row.diverges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800">
            {say({
              language,
              en: "4 · What the workshop adds — and what it does not",
              fr: "4 · Ce que l'atelier ajoute — et ce qu'il ne fait pas",
            })}
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-sky-800">
                {say({ language, en: "What it adds, measured", fr: "Ce qu'il ajoute, mesuré" })}
              </h3>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
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
                  fr: "Ce qu'il ne fait pas — et le dit",
                })}
              </h3>
              <ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-slate-700">
                {WORKSHOP_LIMITS.map((item) => (
                  <li key={item.en}>{cell(item)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-800">
            {say({ language, en: "5 · The references", fr: "5 · Les références" })}
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
          <details className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">
              {say({ language, en: "the printed references", fr: "les références imprimées" })}
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-slate-600">
              {PRINTED_REFERENCES.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          </details>
        </section>

        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={() => navigate("landing")}
            className="rounded-lg border-2 border-slate-300 px-6 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {say({ language, en: "← Landing", fr: "← Accueil" })}
          </button>
          <button
            onClick={() => navigate("tutorial")}
            className="rounded-lg border-2 border-sky-600 px-6 py-3 text-sky-600 font-semibold hover:bg-sky-50 transition-colors"
          >
            {say({ language, en: "Tutorial →", fr: "Tutoriel →" })}
          </button>
          <button
            onClick={() => navigate("workshop")}
            className="rounded-lg bg-sky-600 px-6 py-3 text-white font-semibold hover:bg-sky-500 transition-colors"
          >
            {say({ language, en: "Workshop →", fr: "Atelier →" })}
          </button>
        </div>

        <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          {say({
            language,
            en: "Layered Data — the filiation is part of the rigor: the story names its ancestors, the comparison measures its differences",
            fr: "Layered Data — la filiation fait partie de la rigueur : l'histoire nomme ses ancêtres, la comparaison mesure ses différences",
          })}
        </footer>
      </main>
    </div>
  );
}
