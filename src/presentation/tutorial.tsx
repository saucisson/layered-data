// The tutorial — why data in strata, and how: the philosophers'
// dinner poses the problem and every step reads it again; the cited
// addresses are clickable. The tutorial opens the page — one learns
// the workshop before using it. The spine is drawn in the
// "continuum" step: every line is a button that navigates to the
// layer. This component only renders: no kernel reads, no derived
// state — prose and links. Every text is bilingual: the French is
// the historic prose, the English its mirror.

import React, { useState } from "react";
import { GLOSSARY, NotionTip, NotionText } from "./notions.tsx";
import { localized, say, type BilingualText } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** One step of the tutorial: a block is either prose (a bilingual
 * text, notions ⟪ ⟫ rendered as tooltips) or a real corpus extract
 * ({ code, title }) — the walkthrough alternates the explanation
 * and the explained thing. */
export interface TutorialStep {
  id: string;
  label: BilingualText;
  title: BilingualText;
  body: (BilingualText | { code: string; title: BilingualText })[];
  see?: BilingualText;
  /** real navigation links: each entry navigates to
   * (layer, path) — the cited addresses exist, measured */
  go?: { layer: string; path?: string[]; label: BilingualText }[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "pbm",
    label: { en: "1 · The example, the problem", fr: "1 · L'exemple, le problème" },
    title: {
      en: "The net written four times lies — and its state space no longer knows it",
      fr: "Le réseau écrit quatre fois ment — et son espace d'états ne le connaît plus",
    },
    body: [
      {
        en: "Take the philosophers' dinner. It will follow the whole tutorial. A Petri net is few things. Places (thinking, eating, a fork). Transitions (take, release). Arcs joining the two, each with its weight. Tokens in the places. And yet, in a flat format — JSON, XML — this net is written four times. The schema declares that a place has a marking and an identifier. The instance says that think1 carries a token. The constraint says that an arc has a weight of 1. The rendering draws the graph. Four writings, sharing nothing.",
        fr: "Prenons le dîner des philosophes. Il va suivre tout le tutoriel. Un réseau de Petri, c'est peu de choses. Des places (penser, manger, une fourchette). Des transitions (prendre, relâcher). Des arcs qui relient les deux, chacun avec son poids. Des jetons dans les places. Et pourtant, dans un format plat — JSON, XML —, ce réseau est écrit quatre fois. Le schéma déclare qu'une place a un marquage et un identifiant. L'instance dit que think1 porte un jeton. La contrainte dit qu'un arc a un poids de 1. Le rendu dessine le graphe. Quatre écritures, qui ne partagent rien.",
      },
      {
        en: "The lie comes fast. Decide that your net starts otherwise — the philosopher is already eating. The initial marking must be hunted through the schema, the instance that copies it, the constraint, the drawing that displays it. Missing a single place leaves two truths. Worse: the errors are silent. A misspelled path — places::philo1.think1::marquing, one letter too many — breaks nothing. The read simply returns nothing, and the philosopher seems to think without a token. This is the exact failure mode of an AI assistant writing data: plausible but false, without a single exception.",
        fr: "Le mensonge arrive vite. Décidez que votre réseau démarre autrement — le philosophe mange déjà. Il faut traquer le marquage initial dans le schéma, dans l'instance qui le recopie, dans la contrainte, dans le dessin qui l'affiche. Rater un seul endroit laisse deux vérités. Pire : les erreurs sont silencieuses. Un chemin mal orthographié — places::philo1.think1::marquing, une lettre de trop — ne plante rien. La lecture rend simplement rien, et le philosophe semble penser sans jeton. C'est le mode d'échec exact d'un assistant IA rédigeant des données : plausible mais faux, sans aucune exception.",
      },
      {
        en: "A first shortfall shows without leaving the standard definitions of the literature — the quintuple N = (P, T, F, W, M₀). The net presents itself as a bipartite graph, the state space as a graph: neither definition is written as an instance of a common graph formalism. Everything that holds of a graph in general — a traversal, an acyclicity property, a drawing tool — is rewired at every definition, by hand; the genericity lives in the reader's eye. This tutorial will answer it: the generic graph becomes a layer, and every formalism ⟪refines⟫ it instead of rewiring it.",
        fr: "Un premier manquement se voit sans quitter les définitions standard de la littérature — le quintuplet N = (P, T, F, W, M₀). Le réseau se présente comme un graphe biparti, l'espace d'états comme un graphe : aucune des deux définitions n'est écrite comme instance d'un formalisme de graphe commun. Tout ce qui vaut d'un graphe en général — un parcours, une propriété d'acyclicité, un outil de dessin — se recâble à chaque définition, à la main ; la généricité vit dans l'œil du lecteur. Ce tutoriel y répondra : le graphe générique devient une couche, et chaque formalisme la ⟪raffine⟫ au lieu de le recâbler.",
      },
      {
        en: "But the real wound is deeper. The net presents itself as a bipartite graph, and its state space as a graph. The two definitions do not know each other: nothing in one references the other. The relation lives in prose, in the firing theorem. The state space's nodes should be labeled by « the net with a certain marking ». Most often they label the marking alone — a function of the places, with no path back to the net. And its arcs borrow transitions from the theorem's text, not from the data. The step-1 synchronization was only the symptom. The wound is one of composition: two graphs, no shared address.",
        fr: "Mais la vraie blessure est plus profonde. On présente le réseau comme un graphe biparti, et son espace d'états comme un graphe. Les deux définitions ne se connaissent pas : rien, dans l'une, ne référence l'autre. La relation vit en prose, dans le théorème de tir. Les nœuds de l'espace d'états devraient être étiquetés par « le réseau avec un certain marquage ». Ils n'étiquettent le plus souvent que le marquage seul — une fonction des places, sans chemin de retour vers le réseau. Et ses arcs empruntent des transitions au texte du théorème, pas aux données. La synchronisation de l'étape 1 n'était que le symptôme. La blessure est de composition : deux graphes, aucune adresse partagée.",
      },
    ],
    go: [
      {
        layer: "petrinet-scheme",
        path: ["specification", "place_type"],
        label: {
          en: "petrinet-scheme::specification::place_type — the schema",
          fr: "petrinet-scheme::specification::place_type — le schéma",
        },
      },
      {
        layer: "pn-philosophers-1",
        path: ["places"],
        label: {
          en: "pn-philosophers-1::places — the template, think1/eat1/fork1",
          fr: "pn-philosophers-1::places — le template, think1/eat1/fork1",
        },
      },
      {
        layer: "ss-pn-philosophers-5-inst",
        path: ["states", "s1"],
        label: {
          en: "ss-pn-philosophers-5-inst::states::s1 — a state that knows its net",
          fr: "ss-pn-philosophers-5-inst::states::s1 — un état qui connaît son réseau",
        },
      },
    ],
    see: {
      en: "panel ②, tab « Raw » — the raw of every layer, read by the same kernel as everything else.",
      fr: "panneau ②, onglet « Brut » — le brut de chaque couche, lu par le même noyau que tout le reste.",
    },
  },
  {
    id: "idee",
    label: { en: "2 · The idea", fr: "2 · L'idée" },
    title: {
      en: "The same net, in strata: structure is data",
      fr: "Le même réseau, en strates : la structure est une donnée",
    },
    body: [
      {
        en: "The idea: never write the net four times again — let it sediment. A layered datum is a tree of values, laid in a ⟪layer⟫ that ⟪refines⟫ others (refines). It inherits everything they define. It can specify it, mask it or extend it. The philosophers' dinner rests on the paper's spine. First multihypergraph, the atom: vertices, edges of any size. Then hypergraph, its pure restriction. Then pair-graph (exactly two arrows per edge) and graph, the mathematician's graph (« a 2-uniform hypergraph is a graph »). Then multidigraph and digraph: orientation is a renaming of the connection points. With bipartite-digraph, two classes of vertices. Then petrinet-scheme, the Petri net, refines three layers: the partition, the annotation of the vertices (the marking), that of the edges (the weight). Then pn-philosophers, the philosophers — think/eat/fork, take/release — and the default: an arc carries a weight of 1. Then pn-philosophers-1, the template: one philosopher alone, think1 = 1, eat1 = 0, fork1 = 1. Then pn-philosophers-5, the dinner: five CITATIONS of the template in a collection, linked in a ring by their forks — the engine expands each citation, the members land qualified (philo1.think1…), the data stays in the template. And the chain completes, closing the step-1 wound. Automaton-scheme is a graph whose vertices are states, plus an alphabet. Petrinet-statespace is the state space — an automaton parameterized by the net: the petrinet slot is typed petrinet-scheme, and a state's type descends from the behavior, which refines the parameter — a state's type is the net. Then ss-pn-philosophers-5, the dinner's state space (the petrinet slot laid on the dinner). Finally ss-pn-philosophers-5-inst, one state: s1 lays only philo1.think1 = 2, everything else inherits from the net through its type.",
        fr: "L'idée : ne plus jamais écrire le réseau quatre fois — le sédimenter. Une donnée en strates est un arbre de valeurs, posé dans une ⟪couche⟫ qui en ⟪raffine⟫ d'autres (refines). Elle hérite de tout ce qu'elles définissent. Elle peut le préciser, le masquer ou l'étendre. Le dîner des philosophes repose sur la colonne vertébrale du papier. D'abord multihypergraph, l'atome : des sommets, des arêtes de taille quelconque. Puis hypergraph, sa restriction pure. Puis pair-graph (exactement deux flèches par arête) et graph, le graphe du mathématicien (« a 2-uniform hypergraph is a graph »). Puis multidigraph et digraph : l'orientation est un renommage des points de connexion. Avec bipartite-digraph, voilà deux classes de sommets. Alors petrinet-scheme, le réseau de Petri, raffine trois couches : la partition, l'annotation des sommets (le marquage), celle des arêtes (le poids). Puis pn-philosophers, les philosophes — think/eat/fork, take/release — et le défaut : un arc porte un poids de 1. Puis pn-philosophers-1, le template : un philosophe seul, think1 = 1, eat1 = 0, fork1 = 1. Puis pn-philosophers-5, le dîner : cinq CITATIONS du template dans une collection, reliées en anneau par leurs fourchettes — le moteur développe chaque citation, les membres atterrissent qualifiés (philo1.think1…), la donnée reste dans le template. Et la chaîne s'achève, refermant la blessure de l'étape 1. Automaton-scheme est un graphe dont les sommets sont des états, plus un alphabet. Petrinet-statespace est l'espace d'états — un automate paramétré par le réseau : le slot petrinet est typé petrinet-scheme, et le type d'un état descend du behavior, qui raffine le paramètre — le type d'un état est le réseau. Puis ss-pn-philosophers-5, l'espace d'états du dîner (le slot petrinet posé au dîner). Enfin ss-pn-philosophers-5-inst, un état : s1 ne pose que philo1.think1 = 2, tout le reste hérite du réseau à travers son type.",
      },
      {
        en: "The read is a ⟪core sample⟫. To read pn-philosophers-1::pre_arcs::pt1::weight, the kernel walks the stack from the newest to the oldest. The arc pt1 says nothing. The philosophers' arc type lays 1. ⟪First-wins⟫: 1, measured. The schema, the instance, the constraint have become ordinary layers, read by the same operation. Neither classes, nor a hard-coded metamodel: the kernel interprets data. The word says the idea. As in geology, layers sediment. And a datum left incomplete stays readable — its holes are inherited.",
        fr: "La lecture est un ⟪carottage⟫. Pour lire pn-philosophers-1::pre_arcs::pt1::weight, le noyau traverse la pile de la plus récente à la plus ancienne. L'arc pt1 ne dit rien. Le type des arcs des philosophes pose 1. ⟪Premier-gagné⟫ : 1, mesuré. Le schéma, l'instance, la contrainte sont devenus des couches ordinaires, lues par la même opération. Ni classes, ni métamodèle codé en dur : le noyau interprète des données. Le mot dit l'idée. Comme en géologie, les couches se sédimentent. Et une donnée restée incomplète reste lisible — ses trous sont hérités.",
      },
    ],
    go: [
      { layer: "multihypergraph", label: { en: "multihypergraph — the atom", fr: "multihypergraph — l'atome" } },
      {
        layer: "bipartite-digraph",
        label: { en: "bipartite-digraph — the two classes", fr: "bipartite-digraph — les deux classes" },
      },
      {
        layer: "petrinet-scheme",
        label: { en: "petrinet-scheme — the Petri net", fr: "petrinet-scheme — le réseau de Petri" },
      },
      { layer: "pn-philosophers", label: { en: "pn-philosophers — the dinner", fr: "pn-philosophers — le dîner" } },
      {
        layer: "pn-philosophers-1",
        label: {
          en: "pn-philosophers-1 — the template: one philosopher alone",
          fr: "pn-philosophers-1 — le template : un philosophe seul",
        },
      },
      {
        layer: "petrinet-statespace",
        label: {
          en: "petrinet-statespace — the state space, parameterized",
          fr: "petrinet-statespace — l'espace d'états, paramétré",
        },
      },
      {
        layer: "ss-pn-philosophers-5-inst",
        path: ["states", "s1"],
        label: {
          en: "ss-pn-philosophers-5-inst::states::s1 — a state: delta laid, type = the net",
          fr: "ss-pn-philosophers-5-inst::states::s1 — un état : delta posé, type = le réseau",
        },
      },
    ],
    see: {
      en: "panel ① — the refinement graph: the spine is visible there, from the base to the state; panel ③ shows the core sample of any address.",
      fr: "panneau ① — le graphe des raffinements : la colonne vertébrale s'y voit, de la base à l'état ; panneau ③ montre le carottage de n'importe quelle adresse.",
    },
  },
  {
    // the language explained step by step — seven gestures,
    // every excerpt the real layer of the corpus
    id: "plume",
    label: { en: "3 · The pen — the language", fr: "3 · La plume — le langage" },
    title: {
      en: "The syntax, step by step: everything above writes itself in seven gestures",
      fr: "La syntaxe, pas-à-pas : tout ce qui précède s'écrit en sept gestes",
    },
    body: [
      {
        en: "The whole corpus — 46 layers, from the base to the dinner — writes itself in an indentation language. No JSON, no braces: one line per gesture, the layout structures. Seven gestures suffice: open a ⟪layer⟫, declare its parents, write a block, lay a value, cite an address, verify, note. Every excerpt below is the corpus's real layer — readable as is in a formalism's « Language » tab.",
        fr: "Le corpus entier — 46 couches, du socle au dîner — s'écrit dans un langage à indentation. Pas de JSON, pas d'accolades : une ligne par geste, la mise en page structure. Sept gestes suffisent : ouvrir une ⟪couche⟫, déclarer ses parents, écrire un bloc, poser une valeur, citer une adresse, vérifier, noter. Chaque extrait ci-dessous est la couche réelle du corpus — lisible telle quelle dans l'onglet « Langage » d'un formalisme.",
      },
      {
        en: "First gesture — open and tie. layer opens the layer; refines declares its parents; then separates the unions. The stack's base, the atom of vertices and edges of any size, ties itself to record:",
        fr: "Premier geste — ouvrir et rattacher. layer ouvre la couche ; refines déclare ses parents ; then sépare les unions. Le socle de la pile, l'atome des sommets et des arêtes de taille quelconque, se rattache à record :",
      },
      {
        code: "layer multihypergraph refines @record",
        title: { en: "multihypergraph — the base", fr: "multihypergraph — le socle" },
      },
      {
        en: "Second gesture — ⟪inherit⟫ by saying nothing. The mathematicians' pure layer ⟪refines⟫ the base and writes NOTHING about its vertices and edges: everything descends. Only two ⟪check⟫s, as data tags — and every refinement inherits them:",
        fr: "Deuxième geste — ⟪hériter⟫ sans rien dire. La couche pure des mathématiciens ⟪raffine⟫ le socle et n'écrit RIEN de ses sommets et de ses arêtes : tout descend. Deux ⟪check⟫ seulement, en étiquettes de données — et tout raffinement les hérite :",
      },
      {
        code: "layer hypergraph refines @multihypergraph\n  check simple, nonempty",
        title: { en: "hypergraph — total inheritance", fr: "hypergraph — l'héritage total" },
      },
      {
        en: "Third gesture — restrict by laying a value. The pen's three acts read in this excerpt: extend (the parent already carries the key, I extend it), override (the parent carries it, I lay it again), abstract (an open slot, no value). pair-graph tightens the base's edges to exactly two arrows:",
        fr: "Troisième geste — restreindre en posant une valeur. Les trois actes de la plume se lisent dans cet extrait : extend (le parent porte déjà la clé, je l'étends), override (le parent la porte, je la repose), abstract (un slot ouvert, sans valeur). pair-graph resserre les arêtes du socle à exactement deux flèches :",
      },
      {
        code: "layer pair-graph refines @multihypergraph\n  edge_type refines @multihypergraph/specification/edge_type\n    extend arrows\n      extend specification\n        extend collection\n          override minimum = 2\n          override maximum = 2",
        title: {
          en: "pair-graph — restriction by value",
          fr: "pair-graph — la restriction par la valeur",
        },
      },
      {
        en: "Fourth gesture — the @ designates. A reference starts with @ and follows an absolute path — @layer/path/… — that crosses the layers (⟪late binding⟫): the same line reads from anywhere. A single-segment path (@petrinet-scheme) cites a whole layer. The ⟪key⟫ is the other way to designate — relative, local to its collection, without @.",
        fr: "Quatrième geste — le @ désigne. Une référence commence par @ et suit un chemin absolu — @couche/chemin/… — qui traverse les couches (⟪liaison tardive⟫) : la même ligne se lit depuis n'importe où. Un chemin d'un seul segment (@petrinet-scheme) cite une couche entière. La ⟪clé⟫ est l'autre façon de désigner — relative, locale à sa collection, sans @.",
      },
      {
        en: "Fifth gesture — declare the types, then fill. Under ⟪specification⟫, the dinner declares its five concrete types; the weight 1 is laid there at the type level — the ⟪constraint⟫ become value, which will descend by inheritance down to the arcs:",
        fr: "Cinquième geste — déclarer les types, puis remplir. Sous ⟪specification⟫, le dîner déclare ses cinq types concrets ; le poids 1 y est posé au niveau du type — la ⟪contrainte⟫ devenue valeur, qui descendra par héritage jusqu'aux arcs :",
      },
      {
        code: "layer pn-philosophers refines @petrinet-scheme\n  extend specification\n    think refines @pn-philosophers/specification/place_type\n    eat refines @pn-philosophers/specification/place_type\n    fork refines @pn-philosophers/specification/place_type\n    take refines @pn-philosophers/specification/transition_type\n    release refines @pn-philosophers/specification/transition_type\n    extend arc_type\n      weight = 1",
        title: { en: "pn-philosophers — the dinner (excerpt)", fr: "pn-philosophers — le dîner (extrait)" },
      },
      {
        en: "Then the model — one philosopher alone. It declares nothing: it fills the schema's collections (the ⟪contents⟫), every member ⟪refines⟫ its type by an absolute path, the arcs designate their ends by @s — one ⟪address⟫ per end:",
        fr: "Puis le modèle — un philosophe seul. Il ne déclare rien : il remplit les collections du schéma (les ⟪contenus⟫), chaque membre ⟪raffine⟫ son type par un chemin absolu, les arcs désignent leurs extrémités par des @ — une ⟪adresse⟫ par extrémité :",
      },
      {
        code: "layer pn-philosophers-1 refines @pn-philosophers\n  extend places\n    think1 refines @pn-philosophers/specification/think\n      identifier = 1\n      marking = 1\n    eat1 refines @pn-philosophers/specification/eat\n      identifier = 1\n      marking = 0\n  extend pre_arcs\n    pt1 refines @petrinet-scheme/specification/pre_arc_type\n      source = @pn-philosophers-1/places/think1\n      target = @pn-philosophers-1/transitions/take1",
        title: {
          en: "pn-philosophers-1 — the template (excerpt)",
          fr: "pn-philosophers-1 — le template (extrait)",
        },
      },
      {
        en: "Sixth gesture — to instance is to cite. The dinner of five copies nothing: the philosophes collection carries one ⟪citation⟫ of the template per philosopher, the containers join the five windows by then — the engine expands, the members land qualified (philo2.think1…), the data stays in the template:",
        fr: "Sixième geste — instancier, c'est citer. Le dîner des cinq ne copie rien : la collection philosophes porte une ⟪citation⟫ du template par philosophe, les conteneurs joignent les cinq fenêtres par then — le moteur développe, les membres atterrissent qualifiés (philo2.think1…), la donnée reste dans le template :",
      },
      {
        code: "layer pn-philosophers-5 refines @pn-philosophers then @positions-grid\n  philosophes refines @collection\n    philo1 refines @pn-philosophers-1\n      identifier = 1\n    philo2 refines @pn-philosophers-1\n      identifier = 2\n    …philosophes 3, 4, 5\n  extend places refines @pn-philosophers-5/philosophes/philo1/places\n    then @pn-philosophers-5/philosophes/philo2/places then …\n  extend pre_arcs\n    fk1 refines @petrinet-scheme/specification/pre_arc_type\n      source = @pn-philosophers-5/places/philo1.fork1\n      target = @pn-philosophers-5/transitions/philo2.take1",
        title: {
          en: "pn-philosophers-5 — five citations (excerpt)",
          fr: "pn-philosophers-5 — cinq citations (extrait)",
        },
      },
      {
        en: "Seventh gesture — note, and that's all. A whole // line becomes a note datum: it travels with the block and documents the key that follows. Add mask (to mute an inheritance — the ⟪mask⟫) and bind (to bind a check slot to an address), and you have the whole language. The rest of this tutorial only reads it.",
        fr: "Septième geste — noter, et c'est tout. Une ligne // entière devient une donnée note : elle voyage avec le bloc et documente la clé qui suit. Ajoutez mask (rendre un héritage muet — le ⟪masque⟫) et bind (lier un slot de check à une adresse), et vous avez tout le langage. Le reste de ce tutoriel ne fait que le lire.",
      },
    ],
    go: [
      {
        layer: "pn-philosophers-1",
        path: ["places"],
        label: { en: "pn-philosophers-1::places — the filled template", fr: "pn-philosophers-1::places — le template rempli" },
      },
      {
        layer: "pn-philosophers-5",
        path: ["philosophes"],
        label: {
          en: "pn-philosophers-5::philosophes — the five citations",
          fr: "pn-philosophers-5::philosophes — les cinq citations",
        },
      },
    ],
    see: {
      en: "the « Language » tab (a formalism's fold): the whole layer in language, colored by the same rules as these excerpts.",
      fr: "l'onglet « Langage » (repli d'un formalisme) : la couche entière en langage, colorée par les mêmes règles que ces extraits.",
    },
  },
  {
    id: "continuum",
    label: { en: "4 · The continuum", fr: "4 · Le continuum" },
    title: {
      en: "Formalisms and models are layers — the net without a jump",
      fr: "Formalismes et modèles sont des couches — le réseau sans saut",
    },
    body: [
      {
        en: "Read the spine again. Petrinet-scheme is a formalism: three declared types — place_type, transition_type, arc_type. Pn-philosophers is a more concrete formalism: the philosophers' five types — think, eat, fork, take, release. And pn-philosophers-1 (the template), pn-philosophers-5 (the dinner) are models — ordinary layers. Everywhere else, the schema is on one side and the data on the other. Here, everything is a layer. No jump from type to instance: a ⟪continuum⟫ of ever more concrete formalisms, down to the models — addressable, refinable, inheriting. The benefit reads on the example. A promise laid at the top of the chain holds for everything that refines it. The weight 1 laid at the philosophers' arc type descends to the template's and the dinner's arcs, which lay nothing (pt1 reads 1, measured). And a model left incomplete stays readable — its holes are inherited.",
        fr: "Relisez la colonne vertébrale. Petrinet-scheme est un formalisme : trois types déclarés — place_type, transition_type, arc_type. Pn-philosophers est un formalisme plus concret : les cinq types des philosophes — think, eat, fork, take, release. Et pn-philosophers-1 (le template), pn-philosophers-5 (le dîner) sont des modèles — des couches ordinaires. Partout ailleurs, le schéma est d'un côté et les données de l'autre. Ici, tout est couche. Pas de saut du type à l'instance : un ⟪continuum⟫ de formalismes de plus en plus concrets, jusqu'aux modèles — adressables, raffinables, héritants. L'intérêt se lit sur l'exemple. Une promesse posée en haut de la chaîne vaut pour tout ce qui la raffine. Le poids 1 posé au type des arcs des philosophes descend jusqu'aux arcs du template et du dîner, qui ne posent rien (pt1 lit 1, mesuré). Et un modèle resté incomplet reste lisible — ses trous sont hérités.",
      },
      {
        en: "The great hierarchy overflows the column. The other axes — arity, acyclicity, partition, weighting — are trees that cross, not one thread. And the rendering is a ⟪lens⟫. Graph-display refines multidigraph and draws circles and lines for every descendant. Petrinet-display does the same for the Petri net. Fifteen real layers carry the thread below, every name is clickable.",
        fr: "La grande hiérarchie déborde la colonne. Les autres axes — arité, acyclicité, partition, pondération — sont des arbres qui se croisent, pas un fil. Et le rendu est une ⟪lentille⟫. Graph-display raffine multidigraph et dessine cercles et traits pour tout descendant. Petrinet-display fait de même pour le réseau de Petri. Quinze couches réelles portent le fil ci-dessous, chaque nom est cliquable.",
      },
    ],
    see: {
      en: "panel ① — the spine is visible there, from multihypergraph to the dinner; panel ③ shows any address's chain.",
      fr: "panneau ① — la colonne vertébrale s'y voit, de multihypergraph au dîner ; panneau ③ montre la chaîne de n'importe quelle adresse.",
    },
  },
  {
    id: "specification",
    label: { en: "5 · Specification and the rest", fr: "5 · Spécification et le reste" },
    title: {
      en: "Declare and fill: two ways of being data",
      fr: "Déclarer et remplir : deux façons d'être une donnée",
    },
    body: [
      {
        en: "The step-1 problem is closed: the net's four writings have become layers, read alike. What remains is to see how a layer distributes them. Every layer separates two regimes. Under ⟪specification⟫ live the declarations. Petrinet-scheme::specification declares place_type (marking, identifier), transition_type (identifier) and arc_type (weight, identifier, source, target). That was the schema. Outside ⟪specification⟫ live the ⟪contents⟫: the concrete collections — places, transitions, pre_arcs, post_arcs. That was the instance.",
        fr: "Le problème de l'étape 1 est refermé : les quatre écritures du réseau sont devenues des couches, lues pareil. Reste à voir comment une couche les distribue. Chaque couche sépare deux régimes. Sous ⟪specification⟫ vivent les déclarations. Petrinet-scheme::specification déclare place_type (marquage, identifiant), transition_type (identifiant) et arc_type (weight, identifiant, source, target). C'était le schéma. Hors ⟪specification⟫ vivent les ⟪contenus⟫ : les collections concrètes — places, transitions, pre_arcs, post_arcs. C'était l'instance.",
      },
      {
        en: "The ⟪constraint⟫ has become a value laid at the type level. Pn-philosophers writes arc_type::weight = 1 — the same declaration address, with one more member. And inheritance carries it down to the template's and the dinner's arcs. The rendering is a ⟪lens⟫: petrinet-display refines multidigraph and draws the net for every descendant, templates laid at the same path as the types. The specification border is an addressing convention, not a mechanism. On both sides, same closures, same first-wins, same crossings. What links them: a collection's type is a ⟪Ref⟫ (places is typed place_type). The declaration governs the contents, and nothing forbids a formalism from having contents.",
        fr: "La ⟪contrainte⟫ est devenue une valeur posée au niveau du type. Pn-philosophers écrit arc_type::weight = 1 — la même adresse de déclaration, avec un membre de plus. Et l'héritage la descend jusqu'aux arcs du template et du dîner. Le rendu est une ⟪lentille⟫ : petrinet-display raffine multidigraph et dessine le réseau pour tout descendant, gabarits posés au même chemin que les types. La frontière specification est une convention d'adressage, pas un mécanisme. Des deux côtés, mêmes fermetures, même premier-gagné, mêmes croisements. Ce qui les relie : le type d'une collection est un ⟪Ref⟫ (places est typé place_type). La déclaration gouverne les contenus, et rien n'interdit à un formalisme d'avoir des contenus.",
      },
    ],
    go: [
      {
        layer: "petrinet-scheme",
        path: ["specification", "place_type"],
        label: {
          en: "petrinet-scheme::specification::place_type — the declaration",
          fr: "petrinet-scheme::specification::place_type — la déclaration",
        },
      },
      {
        layer: "pn-philosophers",
        path: ["specification", "arc_type"],
        label: {
          en: "pn-philosophers::specification::arc_type — the weight = 1 default",
          fr: "pn-philosophers::specification::arc_type — le défaut weight = 1",
        },
      },
      {
        layer: "pn-philosophers-1",
        path: ["pre_arcs"],
        label: {
          en: "pn-philosophers-1::pre_arcs — the template, pt1/er1 (no weight laid)",
          fr: "pn-philosophers-1::pre_arcs — le template, pt1/er1 (aucun poids posé)",
        },
      },
    ],
    see: {
      en: "panel ③ — the keys of petrinet-scheme::specification (the three declared types), then of pn-philosophers::specification/arc_type: the weight key, winner pn-philosophers.",
      fr: "panneau ③ — les clés de petrinet-scheme::specification (les trois types déclarés), puis de pn-philosophers::specification/arc_type : la clé weight, gagnant pn-philosophers.",
    },
  },
  {
    id: "regles",
    label: { en: "6 · Reading", fr: "6 · Lire" },
    title: {
      en: "Closure and first-wins: inheritance as a priority order",
      fr: "Fermeture et premier-gagné : l'héritage comme ordre de priorité",
    },
    body: [
      {
        en: "The ⟪closure⟫ of an ⟪address⟫ (layer, path) is the ordered list of all the nodes that define it: itself, then every refines ancestor. Every read walks this list. The step-2 ⟪core sample⟫ has a name.",
        fr: "La ⟪fermeture⟫ d'une ⟪adresse⟫ (couche, chemin) est la liste ordonnée de tous les nœuds qui la définissent : soi-même, puis chaque ancêtre refines. Toute lecture traverse cette liste. Le ⟪carottage⟫ de l'étape 2 a un nom.",
      },
      {
        en: "⟪First-wins⟫: the kernel returns the first value found. Measured on the template: pn-philosophers-1::pre_arcs::pt1::weight = 1. The arc lays nothing, the philosophers' type wins — inherited. And pn-philosophers-1::places::eat1 locally overrides marking = 0 (think1 keeps 1). Measured on a constraint: pn-philosophers-5-bounds-c1::places::philo1.think1::bound = 1. Refining the dinner by a constraint does not break the model, the value descends. Measured on the great hierarchy's weighted diamond: e2 carries no weight, its chain walks weighted-bipartite (nothing) then weighted-hypergraph — weight = 1, inherited. Redefining locally is ⟪overriding⟫; laying nothing is ⟪inheriting⟫. And the deepest measure, the step-1 closure: ss-pn-philosophers-5-inst::states::s1 lays only philo1.think1 = 2. The values philo1.eat1 = 0 and philo1.fork1 = 1 still read. Its closure walks the state type, which binds late to the petrinet = pn-philosophers-5 parameter — the read descends the net's places (measured: the dinner is in s1's closure). The state's label is no longer the marking alone. It is the delta laid, and the net for type.",
        fr: "⟪Premier-gagné⟫ : le noyau rend la première valeur trouvée. Mesuré sur le template : pn-philosophers-1::pre_arcs::pt1::weight = 1. L'arc ne pose rien, le type des philosophes gagne — hérité. Et pn-philosophers-1::places::eat1 surcharge localement marking = 0 (think1 garde 1). Mesuré sur une contrainte : pn-philosophers-5-bounds-c1::places::philo1.think1::bound = 1. Raffiner le dîner par une contrainte ne casse pas le modèle, la valeur descend. Mesuré sur le diamant pondéré de la grande hiérarchie : e2 ne porte pas weight, sa chaîne traverse weighted-bipartite (rien) puis weighted-hypergraph — weight = 1, hérité. Redéfinir localement, c'est ⟪surcharger⟫ ; ne rien poser, c'est ⟪hériter⟫. Et la mesure la plus profonde, l'étape 1 refermée : ss-pn-philosophers-5-inst::states::s1 ne pose que philo1.think1 = 2. Les valeurs philo1.eat1 = 0 et philo1.fork1 = 1 se lisent quand même. Sa fermeture traverse le type d'état, qui se lie tard au paramètre petrinet = pn-philosophers-5 — la lecture descend les places du réseau (mesuré : le dîner est dans la fermeture de s1). L'étiquette de l'état n'est plus le marquage seul. C'est le delta posé, et le réseau pour type.",
      },
    ],
    go: [
      {
        layer: "pn-philosophers-1",
        path: ["pre_arcs", "pt1"],
        label: {
          en: "pn-philosophers-1::pre_arcs::pt1 — weight = 1, inherited",
          fr: "pn-philosophers-1::pre_arcs::pt1 — weight = 1, hérité",
        },
      },
      {
        layer: "pn-philosophers-1",
        path: ["places", "eat1"],
        label: {
          en: "pn-philosophers-1::places::eat1 — marking = 0, overridden",
          fr: "pn-philosophers-1::places::eat1 — marking = 0, surchargé",
        },
      },
      {
        layer: "pn-philosophers-5-bounds-c1",
        path: ["places", "philo1.think1"],
        label: {
          en: "pn-philosophers-5-bounds-c1::places::philo1.think1 — bound = 1, the constraint",
          fr: "pn-philosophers-5-bounds-c1::places::philo1.think1 — bound = 1, la contrainte",
        },
      },
      {
        layer: "ss-pn-philosophers-5-inst",
        path: ["states", "s1"],
        label: {
          en: "ss-pn-philosophers-5-inst::states::s1 — philo1.eat1 = 0 inherited from the net, philo1.think1 = 2 laid",
          fr: "ss-pn-philosophers-5-inst::states::s1 — philo1.eat1 = 0 hérité du réseau, philo1.think1 = 2 posé",
        },
      },
    ],
    see: {
      en: "panel ③ — the chain, the scan and the winner highlighted; scenarios S10 (the weight inherited through the diamond) and S14 (the state that inherits the net); on graph ①, the amber ring marks the closure's layers.",
      fr: "panneau ③ — la chaîne, le scan et le gagnant en surbrillance ; scénarios S10 (le poids hérité à travers le diamant) et S14 (l'état qui hérite du réseau) ; sur le graphe ①, l'anneau ambre marque les couches de la fermeture.",
    },
  },
  {
    id: "composer",
    label: { en: "7 · Composing", fr: "7 · Composer" },
    title: {
      en: "Unions, masks, late binding, multiple inheritance",
      fr: "Unions, masques, liaison tardive, héritage multiple",
    },
    body: [
      {
        en: "The space also knows how to compose itself — five ways, each measured on the spine or the harness. The ⟪citation⟫s: the dinner no longer copies its template — five citations in a collection, one union equation per container; the engine's reader (expandCitations) expands each cited window, the members land qualified (philo1.think1…), the data stays in the template, the re-anchored arcs point into the dinner (measured: 15 places, 10 transitions, 25 arcs). The ⟪union⟫s: a collection can merge other collections (a diagram's vertices = internal ⊕ terminal nodes) — the enumeration composes. The ⟪mask⟫s: a slot can be present but mute (MASK), the read skips to the next ancestor — selective inheritance without deleting the origin.",
        fr: "L'espace sait aussi se composer — cinq façons, chacune mesurée sur la colonne vertébrale ou le harnais. Les ⟪citation⟫s : le dîner ne copie plus son template — cinq citations dans une collection, une équation d'union par conteneur ; le lecteur du moteur (expandCitations) développe chaque fenêtre citée, les membres atterrissent qualifiés (philo1.think1…), la donnée reste dans le template, les arcs re-ancrés pointent dans le dîner (mesuré : 15 places, 10 transitions, 25 arcs). Les ⟪union⟫s : une collection peut fusionner d'autres collections (les sommets d'un diagramme = nœuds internes ⊕ terminaux) — l'énumération compose. Les ⟪masque⟫s : un slot peut être présent mais muet (MASK), la lecture saute vers l'ancêtre suivant — l'héritage sélectif sans supprimer l'origine.",
      },
      {
        en: "⟪Late binding⟫: the schema says « every collection has a type »; the kernel copies this rule (the ⟪implicits⟫) onto the instances at desugaring. A task that says nothing still inherits its type. This is why a faulty refines stays tied to its type by the closure (measured on bad-pert-2). And the ⟪parameter⟫ is its most beautiful case. Petrinet-behavior declares state_type refining « petrinet » — a path that does not exist on it. The ss-pn-philosophers-5 layer lays petrinet = pn-philosophers-5. The resolution happens in the reading layer: s1's closure contains the dinner (measured), and b1::transition reads the dinner's philo1.take1 — generated by the citation of the template, without anything being copied.",
        fr: "La ⟪liaison tardive⟫ : le schéma dit « chaque collection a un type » ; le noyau recopie cette règle (les ⟪implicits⟫) sur les instances au désucrage. Une tâche qui ne dit rien hérite quand même de son type. C'est pourquoi un refines fautif reste rattaché à son type par la fermeture (mesuré sur bad-pert-2). Et le ⟪paramètre⟫ en est le cas le plus beau. Petrinet-behavior déclare state_type raffinant « petrinet » — un chemin qui n'existe pas chez lui. La couche ss-pn-philosophers-5 pose petrinet = pn-philosophers-5. La résolution se fait dans la couche lisante : la fermeture de s1 contient le dîner (mesuré), et b1::transition lit la philo1.take1 du dîner — générée par la citation du template, sans que rien ne soit copié.",
      },
      {
        en: "Multiple inheritance is data, not a kernel function. Petrinet-scheme refines three layers — bipartite-digraph, the annotation of the vertices, that of the edges (measured). The weighted-bipartite ⟪diamond⟫ refines two. Scenario S11 lays two parents for one type at the pre-arc level; S12 lays three. The core sample walks the branches in the refines order — for weight, the first branch speaks.",
        fr: "L'héritage multiple est une donnée, pas une fonction du noyau. Petrinet-scheme raffine trois couches — bipartite-digraph, l'annotation des sommets, celle des arêtes (mesuré). Le ⟪diamant⟫ weighted-bipartite en raffine deux. Le scénario S11 pose deux parents pour un type au niveau arc pré ; S12 en pose trois. Le carottage traverse les branches dans l'ordre des refines — pour weight, la première branche parle.",
      },
    ],
    go: [
      {
        layer: "petrinet-scheme",
        label: { en: "petrinet-scheme — the three parents", fr: "petrinet-scheme — les trois parents" },
      },
      {
        layer: "weighted-bipartite",
        label: { en: "weighted-bipartite — the diamond", fr: "weighted-bipartite — le diamant" },
      },
      {
        layer: "petrinet-behavior",
        path: ["specification", "state_type"],
        label: {
          en: "petrinet-behavior::specification::state_type — refines the nonexistent parameter",
          fr: "petrinet-behavior::specification::state_type — raffine le paramètre inexistant",
        },
      },
      {
        layer: "ss-pn-philosophers-5",
        label: {
          en: "ss-pn-philosophers-5 — the petrinet parameter laid on the dinner",
          fr: "ss-pn-philosophers-5 — le paramètre petrinet posé au dîner",
        },
      },
    ],
    see: {
      en: "panel ④ — cards S10 (the weighted diamond), S11 (the two-parent type), S12 (the triple inheritance), S13 (the recast trunk) and S14 (the state that inherits the net).",
      fr: "panneau ④ — cartes S10 (le diamant pondéré), S11 (le type à deux parents), S12 (le triple héritage), S13 (le tronc refondu) et S14 (l'état qui hérite du réseau).",
    },
  },
  {
    id: "travail",
    label: { en: "8 · Who sees what", fr: "8 · Qui voit quoi" },
    title: {
      en: "Linter and checks: the division of labor, measured",
      fr: "Linteuse et checks : la division du travail, mesurée",
    },
    body: [
      {
        en: "The ⟪linter⟫ verifies the structure — the memory of our strata: dead references, embeddings, inert late bindings. The ⟪check⟫s carried by the data verify the domain: cycles, duplicates, cardinalities. On the example. A net that would refine a nonexistent layer (a typo in refines): the linter alone sees (1 RAFFINE/ERREUR, measured on bad-pert-2). A place that would cite an unknown step by key: the checks alone see (measured on bad-pert: « unknown predecessor » — the linter is blind to designations by keys). The workshop's space is sound. The defects are planted in the harness's test spaces, to measure who sees what.",
        fr: "La ⟪linteuse⟫ vérifie la structure — la mémoire de nos strates : références mortes, plongements, liaisons tardives inertes. Les ⟪check⟫s portés par les données vérifient le domaine : cycles, doublons, cardinalités. Sur l'exemple. Un réseau qui raffinerait une couche inexistante (une faute de frappe dans refines) : la linteuse seule voit (1 RAFFINE/ERREUR, mesuré sur bad-pert-2). Une place qui citerait par clé une étape inconnue : les checks seuls voient (mesuré sur bad-pert : « prédécesseur inconnu » — la linteuse est aveugle aux désignations par clés). L'espace de l'atelier est sain. Les défauts sont plantés dans les espaces de test du harnais, pour mesurer qui voit quoi.",
      },
      {
        en: "Neither suffices alone: each is the other's exact blind spot. And the ⟪alias⟫'s price is assumed: the same defect is reported at every view address that designates it.",
        fr: "Aucun des deux ne suffit : chacun est l'angle mort exact de l'autre. Et le prix de l'⟪alias⟫ est assumé : un même défaut est rapporté à chaque adresse de vue qui le désigne.",
      },
    ],
    see: {
      en: "panel ② — the Diagnostics & validation fold: the golden reads contract and the verdict, which says what was verified, never « correct ».",
      fr: "panneau ② — repli Diagnostics & validation : le contrat de lectures d'or et le verdict, qui dit ce qui a été vérifié, jamais « correct ».",
    },
  },
  {
    // the third verification floor earns its
    // step — the tests contract, with the seven real
    // expectations of the dinner
    id: "contrat",
    label: { en: "9 · The contract", fr: "9 · Le contrat" },
    title: {
      en: "The tests travel with the layer — the expected is measured, never guessed",
      fr: "Les tests voyagent avec la couche — l'attendu se mesure, il ne se devine pas",
    },
    body: [
      {
        en: "Two verifiers had shared the space — the ⟪linter⟫ for the structure, the ⟪check⟫s for the domain. The third was missing: the one that freezes READS. A tests block lives in the layer; each expect writes an address (path/key) and the value it must return — measured, not desired:",
        fr: "Deux vérificateurs s'étaient partagé l'espace — la ⟪linteuse⟫ pour la structure, les ⟪check⟫ pour le domaine. Il manquait le troisième : celui qui gèle des LECTURES. Un bloc tests vit dans la couche ; chaque expect y écrit une adresse (chemin/clé) et la valeur qu'elle doit rendre — mesurée, pas désirée :",
      },
      {
        code: "tests\n  expect places/philo1.think1/marking = 1\n  expect places/philo1.eat1/marking = 0\n  expect philosophes/philo3/identifier = 3\n  expect pre_arcs/fk2/weight = 1\n  expect positions/philo1.seat/system = \"polar\"\n  expect positions/philo1.seat/x absent\n  expect pre_arcs/fk5/source = @pn-philosophers-5/places/philo5.fork1",
        title: {
          en: "pn-philosophers-5 — the dinner's contract (the seven expectations)",
          fr: "pn-philosophers-5 — le contrat du dîner (les sept attendus)",
        },
      },
      {
        en: "Three forms of expectation: a value (the read must return exactly 1), absent (the read must return null — a polar seat's x descends from the record, never from the scene), a reference (the read must resolve the exact address — the arc fk5 points the fifth's fork). The ⟪contract⟫ travels with the layer — on disk as in memory, in a citation as in a refinement — and the validation replays it at every assembly: a betrayed read is an « expectation-betrayed » verdict that refuses the entry, from staging to the last re-freeze.",
        fr: "Trois formes d'attendu : une valeur (la lecture doit rendre exactement 1), absent (la lecture doit rendre null — le x d'un siège polaire descend du record, jamais de la scène), une référence (la lecture doit résoudre l'adresse exacte — l'arc fk5 pointe la fourchette du cinquième). Le ⟪contrat⟫ voyage avec la couche — au disque comme en mémoire, dans une citation comme dans un raffinement — et la validation le rejoue à chaque assemblage : une lecture trahie est un verdict « attendu-trahi » qui refuse l'entrée, du staging au dernier re-gel.",
      },
      {
        en: "The Tests panel of the fold (②) shows every expectation: met or betrayed, the read value, and the provenance — which layer carried the read. That is where it is measured: the AI proposes the pen, never the truth; an expectation enters a layer only for a read already seen in the workshop. Measured ≠ desired — it is the user who signs the contract.",
        fr: "Le panneau Tests du repli (②) montre chaque attendu : conforme ou trahi, la valeur lue, et la provenance — quelle couche a porté la lecture. C'est là que se mesure : l'IA propose la plume, jamais la vérité ; un attendu n'entre dans une couche que pour une lecture déjà vue dans l'atelier. Mesuré ≠ désiré — c'est l'utilisateur qui signe le contrat.",
      },
    ],
    go: [
      {
        layer: "pn-philosophers-5",
        label: {
          en: "pn-philosophers-5 — the scene's tests block",
          fr: "pn-philosophers-5 — le bloc tests de la scène",
        },
      },
      {
        layer: "pn-philosophers-5",
        path: ["pre_arcs", "fk5"],
        label: {
          en: "pn-philosophers-5::pre_arcs::fk5 — the reference expectation, resolved",
          fr: "pn-philosophers-5::pre_arcs::fk5 — l'attendu référence, résolu",
        },
      },
    ],
    see: {
      en: "the Tests panel (a formalism's fold, ②) — every expectation replayed against the living space, with its provenance.",
      fr: "le panneau Tests (repli d'un formalisme, ②) — chaque attendu rejoué contre l'espace vivant, avec sa provenance.",
    },
  },
  {
    id: "preuve",
    label: { en: "10 · The proof", fr: "10 · La preuve" },
    title: {
      en: "Everything is proven, nothing is believed — and the limits are displayed",
      fr: "Tout est prouvé, rien n'est cru — et les limites sont affichées",
    },
    body: [
      {
        en: "This tool's kernel was proven identical to the Python kernel, byte by byte. 204,149 bytes of compared reads, then seven more spaces, up to the decision diagrams and the assistant. The oracle was then frozen. The harness now lives in TypeScript alone: 84 native assertions, 0 failures, a few seconds, no external call.",
        fr: "Le noyau de cet outil a été prouvé identique au noyau Python, octet par octet. 204 149 octets de lectures comparées, puis sept espaces de plus, jusqu'aux diagrammes de décision et à l'assistant. L'oracle a alors été gelé. Le harnais vit désormais en TypeScript seul : 84 assertions natives, 0 échec, quelques secondes, aucun appel externe.",
      },
      {
        en: "The spine — this tutorial's thread — is measured like everything else: same steps, same golden contract, same verifications. 46 layers in the inventory (37 hierarchy, 9 views) — the pn-philosophers-1 template and its pn-philosophers-5 dinner are counted separately there.",
        fr: "La colonne vertébrale — le fil de ce tutoriel — est mesurée comme tout le reste : mêmes marches, même contrat d'or, mêmes vérifications. 46 couches à l'inventaire (37 de hiérarchie, 9 de vues) — le template pn-philosophers-1 et son dîner pn-philosophers-5 y sont comptés séparément.",
      },
      {
        en: "The limits are assumed. The linter is blind to designations by keys. An unformulated intention is not verified. The alias's price multiplies the reports.",
        fr: "Les limites sont assumées. La linteuse est aveugle aux désignations par clés. Une intention non formulée n'est pas vérifiée. Le prix de l'alias multiplie les signalements.",
      },
    ],
  },
  {
    // the last floor — the full list of
    // notions, each term a hover tooltip
    id: "glossaire",
    label: { en: "11 · The glossary", fr: "11 · Le glossaire" },
    title: {
      en: "Every notion, on hover — the definition where the word lives",
      fr: "Chaque notion, au survol — la définition là où le mot vit",
    },
    body: [
      {
        en: "Every notion of this tutorial is dotted-underlined where it appears: hover, the definition opens. Here, the whole list — same gesture, same source. A definition is not paraphrased: it is cited.",
        fr: "Toutes les notions de ce tutoriel sont soulignées de pointillés là où elles apparaissent : survolez, la définition s'ouvre. Ici, la liste entière — même geste, même source. Une définition ne se paraphrase pas : elle se cite.",
      },
    ],
    see: {
      en: "every term of the list is a tooltip — hover.",
      fr: "chaque terme de la liste est une infobulle — survolez.",
    },
  },
];

/** The tutorial step ids, in declaration order. */
export function tutorialStepIds(): string[] {
  return TUTORIAL_STEPS.map((step) => step.id);
}

export const TUTORIAL_SPINE: { layer: string; depth: number; note: BilingualText }[] = [
  {
    layer: "multihypergraph",
    depth: 0,
    note: { en: "the atom: vertices, edges of any size", fr: "l'atome : des sommets, des arêtes de taille quelconque" },
  },
  {
    layer: "hypergraph",
    depth: 1,
    note: { en: "pure restriction: simple, non-empty edges", fr: "restriction pure : arêtes simples, non vides" },
  },
  {
    layer: "pair-graph",
    depth: 1,
    note: { en: "exactly two arrows per edge, no roles", fr: "exactement deux flèches par arête, sans rôles" },
  },
  {
    layer: "graph",
    depth: 2,
    note: {
      en: "« a 2-uniform hypergraph is a graph » — refines pair-graph and hypergraph",
      fr: "« a 2-uniform hypergraph is a graph » — raffine pair-graph et hypergraph",
    },
  },
  {
    layer: "multidigraph",
    depth: 2,
    note: {
      en: "orientation: a renaming of the connection points",
      fr: "l'orientation : un renommage des points de connexion",
    },
  },
  {
    layer: "digraph",
    depth: 3,
    note: {
      en: "pure arcs — neither parallel nor loops; refines multidigraph and hypergraph",
      fr: "arcs purs — ni parallèles ni boucles ; raffine multidigraph et hypergraph",
    },
  },
  {
    layer: "automaton-scheme",
    depth: 3,
    note: {
      en: "the automaton: a graph whose vertices are states, plus an alphabet",
      fr: "l'automate : un graphe dont les sommets sont des états, plus un alphabet",
    },
  },
  {
    layer: "bipartite-digraph",
    depth: 4,
    note: {
      en: "two classes of vertices: places on one side, transitions on the other",
      fr: "deux classes de sommets : places d'un côté, transitions de l'autre",
    },
  },
  {
    layer: "vertex-annotated-hypergraph",
    depth: 4,
    note: { en: "the vertex annotation axis: the marking", fr: "l'axe annotation des sommets : le marquage" },
  },
  {
    layer: "edge-annotated-hypergraph",
    depth: 4,
    note: { en: "the edge annotation axis: the weight", fr: "l'axe annotation des arêtes : le poids" },
  },
  {
    layer: "petrinet-scheme",
    depth: 5,
    note: {
      en: "the Petri net: three parents — bipartite + the two annotations",
      fr: "le réseau de Petri : trois parents — bipartite + les deux annotations",
    },
  },
  {
    layer: "pn-philosophers",
    depth: 6,
    note: {
      en: "the philosophers: think/eat/fork, take/release, arc_type weight = 1",
      fr: "les philosophes : think/eat/fork, take/release, arc_type weight = 1",
    },
  },
  {
    layer: "pn-philosophers-1",
    depth: 7,
    note: {
      en: "the template: one philosopher alone — think1 = 1, eat1 = 0, fork1 = 1",
      fr: "le template : un philosophe seul — think1 = 1, eat1 = 0, fork1 = 1",
    },
  },
  {
    layer: "pn-philosophers-5",
    depth: 8,
    note: {
      en: "the dinner: five citations of the template in a ring, shared forks",
      fr: "le dîner : cinq citations du template en anneau, fourchettes partagées",
    },
  },
  {
    layer: "petrinet-statespace",
    depth: 9,
    note: {
      en: "the conclusion: the state space — an automaton parameterized by the net; a state's type is the net",
      fr: "le dénouement : l'espace d'états — un automate paramétré par le réseau ; le type d'un état est le réseau",
    },
  },
  {
    layer: "ss-pn-philosophers-5",
    depth: 10,
    note: {
      en: "the dinner's space: the petrinet slot laid on the dinner, resolved late",
      fr: "l'espace du dîner : le slot petrinet posé au dîner, résolu tard",
    },
  },
  {
    layer: "ss-pn-philosophers-5-inst",
    depth: 11,
    note: {
      en: "one state: s1 lays only philo1.think1 = 2 — the rest inherits from the net through the state type",
      fr: "un état : s1 ne pose que philo1.think1 = 2 — le reste hérite du réseau à travers le type d'état",
    },
  },
];

export function Tutorial({
  onNavigate,
  language,
}: {
  onNavigate: (layer: string, path: string[]) => void;
  language: Language;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = TUTORIAL_STEPS[stepIndex];
  return (
    <section className="mx-4 mt-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-800">
        {say({
          language,
          en: "The tutorial — why data in strata, and how",
          fr: "Le tutoriel — pourquoi les données en strates, et comment",
        })}
        <span className="ml-1 font-normal text-slate-400">
          {say({
            language,
            en: "the philosophers' dinner poses the problem and every step reads it again; the cited addresses are clickable",
            fr: "le dîner des philosophes pose le problème et chaque étape le relit ; les adresses citées sont cliquables",
          })}
        </span>
      </h2>
      <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
        {TUTORIAL_STEPS.map((stepEntry, index) => (
          <button
            key={stepEntry.id}
            onClick={() => setStepIndex(index)}
            className={
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors " +
              (index === stepIndex
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200")
            }
          >
            {localized({ language, text: stepEntry.label })}
          </button>
        ))}
      </div>
      <h3 className="text-[13px] font-bold text-slate-800">
        {localized({ language, text: currentStep.title })}
      </h3>
      {currentStep.body.map((block, index) =>
        "code" in block ? (
          <div
            key={index}
            className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {localized({ language, text: block.title })}
            </div>
            <pre className="overflow-x-auto font-mono text-[11px] leading-4 text-slate-800">
              {block.code}
            </pre>
          </div>
        ) : (
          <p key={index} className="mt-1.5 text-xs leading-5 text-slate-700">
            <NotionText text={localized({ language, text: block })} language={language} />
          </p>
        ),
      )}
      {currentStep.id === "glossaire" && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {Object.keys(GLOSSARY).map((term) => (
            <NotionTip key={term} term={term} language={language} />
          ))}
        </div>
      )}
      {currentStep.id === "continuum" && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="font-mono text-[11px] leading-5">
            {TUTORIAL_SPINE.map((spineEntry) => (
              <div key={spineEntry.layer} style={{ paddingLeft: spineEntry.depth * 18 }}>
                <button
                  onClick={() => onNavigate(spineEntry.layer, [])}
                  title={say({ language, en: "go to layer ", fr: "aller à la couche " }) + spineEntry.layer}
                  className="rounded px-1 font-bold text-amber-800 underline decoration-dotted hover:bg-amber-100"
                >
                  {spineEntry.layer}
                </button>
                <span className="ml-1 text-slate-600">
                  {localized({ language, text: spineEntry.note })}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {say({
              language,
              en: "Sixteen real layers of the spine (out of 42) — measured by the harness, every name is a button.",
              fr: "Seize couches réelles de la colonne vertébrale (sur 42) — mesurées par le harnais, chaque nom est un bouton.",
            })}
          </p>
        </div>
      )}
      {currentStep.go && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-slate-600">
          {say({ language, en: "Go and see:", fr: "Aller voir :" })}
          {currentStep.go.map((goEntry) => (
            <button
              key={goEntry.layer + (goEntry.path ? "::" + goEntry.path.join("::") : "")}
              onClick={() => onNavigate(goEntry.layer, goEntry.path ?? [])}
              title={
                say({ language, en: "navigate to ", fr: "naviguer vers " }) +
                goEntry.layer +
                (goEntry.path ? "::" + goEntry.path.join("::") : "")
              }
              className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] hover:border-slate-500 hover:bg-slate-100"
            >
              {localized({ language, text: goEntry.label })}
            </button>
          ))}
        </p>
      )}
      {currentStep.see && (
        <p className="mt-2 border-l-2 border-slate-300 bg-slate-50 py-1 pl-2 text-[11px] leading-4 text-slate-600">
          {say({ language, en: "To see in the tool: ", fr: "À voir dans l'outil : " })}
          {localized({ language, text: currentStep.see })}
        </p>
      )}
      <p className="mt-2 text-[10px] leading-4 text-slate-400">
        {say({
          language,
          en: "The cited numbers are measured by the workshop's standalone harness.",
          fr: "Les chiffres cités sont mesurés par le harnais autonome de l'atelier.",
        })}
      </p>
    </section>
  );
}
