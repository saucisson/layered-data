// The tutorial — layered data in eleven steps: the philosophers'
// dinner is the running example, every step pairs an idea with the
// real corpus excerpt that carries it, and the layer names of the
// column are clickable. The tutorial renders as one scrollable page
// — every step is a section, prose and real corpus excerpts
// alternate, the excerpts are colored by the same rules as the
// « Language » tab. This component only renders: no kernel reads, no
// derived state — prose and links. Every text is bilingual: the
// French is the historic prose, the English its mirror.

import React from "react";
import { GLOSSARY, NotionTip, NotionText } from "./notions.tsx";
import { localized, say, type BilingualText } from "./i18n.ts";
import { highlightSourceLine, SPAN_CLASSES } from "./layerSourceView.tsx";
import type { Language } from "../domain/messages.ts";

/** One section of the tutorial: a block is either prose (a bilingual
 * text, notions ⟪ ⟫ rendered as tooltips) or a real corpus extract
 * ({ code, title }) — the walkthrough alternates the explanation
 * and the explained thing. */
export interface TutorialStep {
  id: string;
  label: BilingualText;
  title: BilingualText;
  body: (BilingualText | { code: string; title: BilingualText })[];
  see?: BilingualText;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    // the itch — the four worlds every modeling tool splits a model
    // into, and the dinner that will follow the whole walkthrough
    id: "pbm",
    label: { en: "1 · The problem", fr: "1 · Le problème" },
    title: {
      en: "One model, several worlds: the itch before the layers",
      fr: "Un modèle, plusieurs mondes : la démangeaison avant les couches",
    },
    body: [
      {
        en: "Take a Petri net — the philosophers' dinner will be our running example, and every step of this tutorial reads it again. A net is little: places (thinking, eating, a fork), transitions (take, release), arcs joining them, each with its weight, tokens in the places. Now write it down with today's tools. The definition of what a Petri net is lives in one world (a metamodel, a schema). The model of the five philosophers lives in another (an editor file, an instance). The constraints — no deadlock, a bounded number of tokens — live in a third (a temporal-logic formula, a constraint language). The drawing of the net lives in a fourth (a renderer's code). Four worlds, four languages, four tool chains: every crossing is a translation, and when the definition changes, the copies drift.",
        fr: "Prenons un réseau de Petri — le dîner des philosophes sera notre exemple suivi, et chaque étape de ce tutoriel le relit. Un réseau, c'est peu : des places (penser, manger, une fourchette), des transitions (prendre, relâcher), des arcs qui les relient, chacun avec son poids, des jetons dans les places. Écrivez-le maintenant avec les outils d'aujourd'hui. La définition de ce qu'est un réseau de Petri vit dans un monde (un métamodèle, un schéma). Le modèle des cinq philosophes vit dans un autre (un fichier d'éditeur, une instance). Les contraintes — pas d'interblocage, un nombre de jetons borné — vivent dans un troisième (une formule de logique temporelle, un langage de contraintes). Le dessin du réseau vit dans un quatrième (le code d'un rendu). Quatre mondes, quatre langages, quatre chaînes d'outils : chaque franchissement est une traduction, et quand la définition change, les copies dérivent.",
      },
      {
        en: "Layered data answers with a single move: drop the worlds, keep the strata. One kind of datum, read by one operation — the rest of this page walks that move, section by section, on the dinner. Each section pairs an idea with the real corpus excerpt that carries it, and the « To see in the tool » line points at the workshop panels where it is measured. The layer names of the stratigraphic column are clickable: they open the workshop on that layer.",
        fr: "Les layered data répondent par un seul geste : supprimer les mondes, garder les strates. Une seule espèce de donnée, lue par une seule opération — le reste de cette page parcourt ce geste, section par section, sur le dîner. Chaque section marie une idée à l'extrait réel du corpus qui la porte, et la ligne « À voir dans l'outil » pointe les panneaux de l'atelier où elle se mesure. Les noms des couches de la colonne stratigraphique sont cliquables : ils ouvrent l'atelier sur cette couche.",
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
      en: "Let the net sediment: everything is a layer",
      fr: "Laisser le réseau se déposer : tout est couche",
    },
    body: [
      {
        en: "The idea in one sentence: a layered datum is a tree of values laid in a ⟪layer⟫ that ⟪refines⟫ other layers — and everything else (definition, model, constraint, drawing) is a layer too. What a layer does not lay, it reads from its parents: to lay nothing is to ⟪inherit⟫. Two acts cover the rest — specify (lay a tighter value), extend (add a branch). No class, no hard-wired metamodel: the kernel interprets data, and the word for the gesture is borrowed from geology — strata sediment, each one complete, each one readable on top of the others.",
        fr: "L'idée en une phrase : une donnée en strates est un arbre de valeurs posé dans une ⟪couche⟫ qui en ⟪raffine⟫ d'autres — et tout le reste (définition, modèle, contrainte, dessin) est une couche aussi. Ce qu'une couche ne pose pas, elle le lit chez ses parents : ne rien poser, c'est ⟪hériter⟫. Deux actes couvrent le reste — préciser (poser une valeur plus serrée), étendre (ajouter une branche). Ni classe, ni métamodèle codé en dur : le noyau interprète des données, et le mot du geste est emprunté à la géologie — les strates se déposent, chacune complète, chacune lisible au-dessus des autres.",
      },
      {
        en: "The dinner rests on a stack that the paper's stratigraphic column makes visible. At the bottom, multihypergraph — the atom: vertices, edges of any size. Hypergraph is its pure restriction (simple, non-empty edges); pair-graph tightens every edge to exactly two arrows, and graph — « a 2-uniform hypergraph is a graph » — refines both. Multidigraph and digraph add orientation as a renaming of the connection points; bipartite-digraph splits the vertices into two classes. Then petrinet-scheme, the Petri net itself, refines three layers: the partition, the annotation of the vertices (the marking), that of the edges (the weight). Pn-philosophers names the dinner's vocabulary — think, eat, fork, take, release — and lays the default: an arc carries weight 1. The template pn-philosophers-1 writes one philosopher alone; the dinner pn-philosophers-5 cites it five times in a collection, the ring closing on the shared forks. Above the net, the state space: automaton-scheme (a graph whose vertices are states, plus an alphabet), petrinet-statespace — an automaton whose petrinet slot is typed petrinet-scheme, so a state's type descends from the net — then ss-pn-philosophers-5, which lays that slot on the dinner, and ss-pn-philosophers-5-inst, one state that lays only philo1.think1 = 2: everything else is inherited through its type.",
        fr: "Le dîner repose sur une pile que la colonne stratigraphique du papier rend visible. Au fond, multihypergraph — l'atome : des sommets, des arêtes de taille quelconque. Hypergraph en est la restriction pure (arêtes simples, non vides) ; pair-graph resserre chaque arête à exactement deux flèches, et graph — « a 2-uniform hypergraph is a graph » — raffine les deux. Multidigraph et digraph ajoutent l'orientation comme un renommage des points de connexion ; bipartite-digraph sépare les sommets en deux classes. Puis petrinet-scheme, le réseau de Petri lui-même, raffine trois couches : la partition, l'annotation des sommets (le marquage), celle des arêtes (le poids). Pn-philosophers nomme le vocabulaire du dîner — think, eat, fork, take, release — et pose le défaut : un arc porte un poids de 1. Le template pn-philosophers-1 écrit un philosophe seul ; le dîner pn-philosophers-5 le cite cinq fois dans une collection, l'anneau se refermant sur les fourchettes partagées. Au-dessus du réseau, l'espace d'états : automaton-scheme (un graphe dont les sommets sont des états, plus un alphabet), petrinet-statespace — un automate dont le slot petrinet est typé petrinet-scheme, si bien que le type d'un état descend du réseau — puis ss-pn-philosophers-5, qui pose ce slot sur le dîner, et ss-pn-philosophers-5-inst, un état qui ne pose que philo1.think1 = 2 : tout le reste est hérité à travers son type.",
      },
      {
        en: "And the first read, to taste the gesture. To read pn-philosophers-1::pre_arcs::pt1::weight — the weight of one arc of the template — the kernel walks the ⟪closure⟫ of that ⟪address⟫, from the newest layer to the oldest. The arc lays nothing about its weight; the philosophers' arc type, older, lays 1. ⟪First-wins⟫: 1, measured. The definition that would have been a schema, the model that would have been an instance, the default that would have been a constraint: all three are ordinary layers here, read by the same operation — and a datum left incomplete stays readable, its holes inherited.",
        fr: "Et la première lecture, pour goûter le geste. Pour lire pn-philosophers-1::pre_arcs::pt1::weight — le poids d'un arc du template — le noyau traverse la ⟪fermeture⟫ de cette ⟪adresse⟫, de la couche la plus récente à la plus ancienne. L'arc ne pose rien de son poids ; le type des arcs des philosophes, plus ancien, pose 1. ⟪Premier-gagné⟫ : 1, mesuré. La définition qui aurait été un schéma, le modèle qui aurait été une instance, le défaut qui aurait été une contrainte : les trois sont ici des couches ordinaires, lues par la même opération — et une donnée restée incomplète reste lisible, ses trous hérités.",
      },
    ],
    see: {
      en: "panel ① — the refinement graph: the column from the base to the state; panel ③ — the core sample of any address.",
      fr: "panneau ① — le graphe des raffinements : la colonne de la base à l'état ; panneau ③ — le carottage de n'importe quelle adresse.",
    },
  },
  {
    // the language explained gesture by gesture — seven lines,
    // every excerpt the real layer of the corpus
    id: "geologue",
    label: { en: "3 · The geologist's language", fr: "3 · Le langage du géologue" },
    title: {
      en: "Seven gestures write the whole corpus",
      fr: "Sept gestes écrivent tout le corpus",
    },
    body: [
      {
        en: "The language that writes those strata is an indentation language: one line per gesture, the layout structures, no JSON, no braces. The whole corpus — 47 layers, from the base to the dinner — writes itself in seven gestures: open a ⟪layer⟫, declare its parents, write a block, lay a value, cite an address, verify, note. Every excerpt below is a real layer of the corpus, readable as is in its « Language » tab. The tutorial calls it the geologist's language because the workshop's AI writer bears that name — but the language itself is entirely human-readable.",
        fr: "Le langage qui écrit ces strates est un langage à indentation : une ligne par geste, la mise en page structure, pas de JSON, pas d'accolades. Le corpus entier — 47 couches, du socle au dîner — s'écrit en sept gestes : ouvrir une ⟪couche⟫, déclarer ses parents, écrire un bloc, poser une valeur, citer une adresse, vérifier, noter. Chaque extrait ci-dessous est une couche réelle du corpus, lisible telle quelle dans son onglet « Langage ». Le tutoriel l'appelle le langage du géologue parce que le rédacteur IA de l'atelier porte ce nom — mais le langage lui-même est entièrement lisible par un humain.",
      },
      {
        en: "First gesture — open and tie. layer opens the layer, refines declares its parents — there may be several, then separates them. The base of the stack ties itself to record, the kernel's floor:",
        fr: "Premier geste — ouvrir et rattacher. layer ouvre la couche, refines déclare ses parents — il peut y en avoir plusieurs, then les sépare. Le socle de la pile se rattache à record, le sol du noyau :",
      },
      {
        code: "layer multihypergraph refines @record",
        title: { en: "multihypergraph — the base", fr: "multihypergraph — le socle" },
      },
      {
        en: "Second gesture — ⟪inherit⟫ by saying nothing. The mathematicians' pure layer ⟪refines⟫ the base and writes NOTHING about its vertices and edges: everything descends. Two ⟪check⟫ tags only, carried as data — and every refinement inherits them:",
        fr: "Deuxième geste — ⟪hériter⟫ sans rien dire. La couche pure des mathématiciens ⟪raffine⟫ le socle et n'écrit RIEN de ses sommets et de ses arêtes : tout descend. Deux étiquettes ⟪check⟫ seulement, portées comme des données — et tout raffinement les hérite :",
      },
      {
        code: "layer hypergraph refines @multihypergraph\n  check simple, nonempty",
        title: { en: "hypergraph — total inheritance", fr: "hypergraph — l'héritage total" },
      },
      {
        en: "Third gesture — restrict by laying a value. Three acts read in this excerpt: extend (the parent already carries the key, I extend it), override (the parent carries it, I lay it again), abstract (an open ⟪slot⟫, no value). pair-graph tightens the base's edges to exactly two arrows:",
        fr: "Troisième geste — restreindre en posant une valeur. Trois actes se lisent dans cet extrait : extend (le parent porte déjà la clé, je l'étends), override (le parent la porte, je la repose), abstract (un ⟪slot⟫ ouvert, sans valeur). pair-graph resserre les arêtes de la base à exactement deux flèches :",
      },
      {
        code: "layer pair-graph refines @multihypergraph\n  edge_type refines @multihypergraph/specification/edge_type\n    extend arrows\n      extend specification\n        extend collection\n          override minimum = 2\n          override maximum = 2",
        title: {
          en: "pair-graph — restriction by value",
          fr: "pair-graph — la restriction par la valeur",
        },
      },
      {
        en: "Fourth gesture — the @ designates. A reference starts with @ and follows an absolute path — @layer/path/… — that crosses the layers (⟪late binding⟫): the same line reads from anywhere. A single-segment path (@petrinet-scheme) cites a whole layer. The ⟪key⟫ is the other designation — relative, local to its collection, without @. Fifth gesture — declare the types, then fill. Under ⟪specification⟫, the dinner declares its concrete vocabulary; the default weight 1 is laid there, at the type level — the ⟪constraint⟫ become value, which will descend to the arcs:",
        fr: "Quatrième geste — le @ désigne. Une référence commence par @ et suit un chemin absolu — @couche/chemin/… — qui traverse les couches (⟪liaison tardive⟫) : la même ligne se lit depuis n'importe où. Un chemin d'un seul segment (@petrinet-scheme) cite une couche entière. La ⟪clé⟫ est l'autre désignation — relative, locale à sa collection, sans @. Cinquième geste — déclarer les types, puis remplir. Sous ⟪specification⟫, le dîner déclare son vocabulaire concret ; le poids 1 par défaut y est posé au niveau du type — la ⟪contrainte⟫ devenue valeur, qui descendra jusqu'aux arcs :",
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
        en: "Sixth gesture — to instance is to cite. The dinner of five copies nothing: one ⟪citation⟫ of the template per philosopher, the containers join the five windows with then — the engine expands, the members land qualified (philo2.think1…), the data stays in the template:",
        fr: "Sixième geste — instancier, c'est citer. Le dîner des cinq ne copie rien : une ⟪citation⟫ du template par philosophe, les conteneurs joignent les cinq fenêtres par then — le moteur développe, les membres atterrissent qualifiés (philo2.think1…), la donnée reste dans le template :",
      },
      {
        code: "layer pn-philosophers-5 refines @pn-philosophers then @positions-grid\n  philosophes refines @collection\n    philo1 refines @pn-philosophers-1\n      identifier = 1\n    philo2 refines @pn-philosophers-1\n      identifier = 2\n    …philosophes 3, 4, 5\n  extend places refines @pn-philosophers-5/philosophes/philo1/places\n    then @pn-philosophers-5/philosophes/philo2/places then …\n  extend pre_arcs\n    fk1 refines @petrinet-scheme/specification/pre_arc_type\n      source = @pn-philosophers-5/places/philo1.fork1\n      target = @pn-philosophers-5/transitions/philo2.take1",
        title: {
          en: "pn-philosophers-5 — five citations (excerpt)",
          fr: "pn-philosophers-5 — cinq citations (extrait)",
        },
      },
      {
        en: "Seventh gesture — note, and that is all: a // line becomes a note datum that travels with its block and documents the key that follows. One act completes the language — bind, to bind a ⟪check⟫ slot to an address. The rest of this tutorial only reads what these seven gestures write.",
        fr: "Septième geste — noter, et c'est tout : une ligne // devient une donnée note qui voyage avec son bloc et documente la clé qui suit. Un acte complète le langage — bind, pour lier un slot de ⟪check⟫ à une adresse. Le reste de ce tutoriel ne fait que lire ce que ces sept gestes écrivent.",
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
      en: "From formalism to model, no jump",
      fr: "Du formalisme au modèle, pas de saut",
    },
    body: [
      {
        en: "Reread the column with the definition/model pair in mind. Petrinet-scheme is a formalism: it declares place_type, transition_type, arc_type. Pn-philosophers is a more concrete formalism: five types — think, eat, fork, take, release. The template and the dinner are models — ordinary layers like the others. Everywhere else the schema is on one side, the data on the other, and instancing is an operation that crosses a wall. Here there is no wall: a ⟪continuum⟫ of ever more concrete formalisms, down to the models — all addressable, all refinable, all inheriting.",
        fr: "Relisez la colonne avec en tête le couple définition/modèle. Petrinet-scheme est un formalisme : il déclare place_type, transition_type, arc_type. Pn-philosophers est un formalisme plus concret : cinq types — think, eat, fork, take, release. Le template et le dîner sont des modèles — des couches ordinaires comme les autres. Partout ailleurs, le schéma est d'un côté, les données de l'autre, et l'instanciation est une opération qui franchit un mur. Ici, pas de mur : un ⟪continuum⟫ de formalismes de plus en plus concrets, jusqu'aux modèles — tous adressables, tous raffinables, tous héritants.",
      },
      {
        en: "The benefit reads on the example. A promise laid at the top of the chain holds for everything that refines it: the weight 1 laid at the philosophers' arc type descends to the template's and the dinner's arcs, which lay nothing — pt1 reads 1, measured. A model left incomplete stays readable, its holes inherited. And the column overflows on both ends: the other axes (arity, acyclicity, partition, weighting) are ⟪facet⟫ trees that cross the thread, and the rendering is a ⟪lens⟫ — graph-display refines multidigraph and draws circles and lines for every descendant, petrinet-display does the same for the Petri net. Sixteen real layers carry the thread below; every name is a button.",
        fr: "L'intérêt se lit sur l'exemple. Une promesse posée en haut de la chaîne vaut pour tout ce qui la raffine : le poids 1 posé au type des arcs des philosophes descend jusqu'aux arcs du template et du dîner, qui ne posent rien — pt1 lit 1, mesuré. Un modèle resté incomplet reste lisible, ses trous hérités. Et la colonne déborde par les deux bouts : les autres axes (arité, acyclicité, partition, pondération) sont des arbres de ⟪facettes⟫ qui croisent le fil, et le rendu est une ⟪lentille⟫ — graph-display raffine multidigraph et dessine cercles et traits pour tout descendant, petrinet-display fait de même pour le réseau de Petri. Seize couches réelles portent le fil ci-dessous ; chaque nom est un bouton.",
      },
    ],
    see: {
      en: "panel ① — the column from multihypergraph to the dinner; panel ③ — the chain of any address.",
      fr: "panneau ① — la colonne de multihypergraph au dîner ; panneau ③ — la chaîne de n'importe quelle adresse.",
    },
  },
  {
    id: "specification",
    label: { en: "5 · Specification and contents", fr: "5 · Spécification et contenus" },
    title: {
      en: "The schema and the instance, two regimes of one tree",
      fr: "Le schéma et l'instance, deux régimes d'un même arbre",
    },
    body: [
      {
        en: "Inside a layer, two regimes. Under ⟪specification⟫ live the declarations — that was the schema: petrinet-scheme::specification declares place_type (marking, identifier), transition_type (identifier), arc_type (weight, identifier, source, target). Outside ⟪specification⟫ live the ⟪contents⟫ — that was the instance: the concrete collections places, transitions, pre_arcs, post_arcs. What links the two regimes: a collection's type is a ⟪Ref⟫ (places is typed place_type), and the declaration governs the contents — nothing forbids a formalism from having contents of its own.",
        fr: "Dans une couche, deux régimes. Sous ⟪specification⟫ vivent les déclarations — c'était le schéma : petrinet-scheme::specification déclare place_type (marquage, identifiant), transition_type (identifiant), arc_type (poids, identifiant, source, target). Hors ⟪specification⟫ vivent les ⟪contenus⟫ — c'était l'instance : les collections concrètes places, transitions, pre_arcs, post_arcs. Ce qui relie les deux régimes : le type d'une collection est un ⟪Ref⟫ (places est typé place_type), et la déclaration gouverne les contenus — rien n'interdit à un formalisme d'avoir des contenus.",
      },
      {
        en: "The ⟪constraint⟫, here, is a value laid at the type level. Pn-philosophers writes arc_type::weight = 1 — the same declaration address with one more member — and inheritance carries it down to the template's and the dinner's arcs. The border between the two regimes is an addressing convention, not a mechanism: same closures, same ⟪first-wins⟫, same crossings on both sides. The drawing itself is data — the ⟪lens⟫ templates are laid at the same paths as the types, and petrinet-display draws the net for every descendant.",
        fr: "La ⟪contrainte⟫, ici, est une valeur posée au niveau du type. Pn-philosophers écrit arc_type::weight = 1 — la même adresse de déclaration, avec un membre de plus — et l'héritage la descend jusqu'aux arcs du template et du dîner. La frontière entre les deux régimes est une convention d'adressage, pas un mécanisme : mêmes fermetures, même ⟪premier-gagné⟫, mêmes croisements des deux côtés. Le dessin lui-même est une donnée — les gabarits de la ⟪lentille⟫ sont posés aux mêmes chemins que les types, et petrinet-display dessine le réseau pour tout descendant.",
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
      en: "Closure and first-wins: how a read is decided",
      fr: "Fermeture et premier-gagné : comment se décide une lecture",
    },
    body: [
      {
        en: "The ⟪closure⟫ of an ⟪address⟫ is the ordered list of all the nodes that define it: itself, then every refines ancestor. Every read walks this list from the newest to the oldest — the ⟪core sample⟫ of the idea step now has its name — and one rule suffices: ⟪first-wins⟫, the first value found is the answer. The order of the refines list encodes the specificity, the same order the geologist's language writes, and no rule lives in the engine.",
        fr: "La ⟪fermeture⟫ d'une ⟪adresse⟫ est la liste ordonnée de tous les nœuds qui la définissent : soi-même, puis chaque ancêtre par refines. Toute lecture traverse cette liste de la plus récente à la plus ancienne — le ⟪carottage⟫ de l'étape de l'idée a maintenant son nom — et une seule règle suffit : ⟪premier-gagné⟫, la première valeur trouvée est la réponse. L'ordre de la liste des refines encode la spécificité, le même ordre que celui qu'écrit le langage du géologue, et aucune règle ne vit dans le moteur.",
      },
      {
        en: "Four measured reads, then the deepest. On the template: pn-philosophers-1::pre_arcs::pt1::weight = 1 — the arc lays nothing, the type wins: to lay nothing is to ⟪inherit⟫. On a local value: pn-philosophers-1::places::eat1 overrides marking = 0 while think1 keeps 1 — to lay again is to ⟪override⟫. On a constraint refined over the dinner: pn-philosophers-5-bounds-c1::places::philo1.think1::bound = 1 — refining a model by a constraint does not break it, the value descends. On the weighted ⟪diamond⟫ of the great hierarchy: e2 carries no weight, its chain walks weighted-bipartite (nothing) then weighted-hypergraph — weight = 1, inherited. And the deepest: ss-pn-philosophers-5-inst::states::s1 lays only philo1.think1 = 2; philo1.eat1 = 0 and philo1.fork1 = 1 still read, because the state's closure walks its type, which binds late to the petrinet parameter laid on the dinner — a state's type is the net, and the net answers through it.",
        fr: "Quatre lectures mesurées, puis la plus profonde. Sur le template : pn-philosophers-1::pre_arcs::pt1::weight = 1 — l'arc ne pose rien, le type gagne : ne rien poser, c'est ⟪hériter⟫. Sur une valeur locale : pn-philosophers-1::places::eat1 surcharge marking = 0 pendant que think1 garde 1 — reposer, c'est ⟪surcharger⟫. Sur une contrainte posée au-dessus du dîner : pn-philosophers-5-bounds-c1::places::philo1.think1::bound = 1 — raffiner un modèle par une contrainte ne le casse pas, la valeur descend. Sur le ⟪diamant⟫ pondéré de la grande hiérarchie : e2 ne porte pas weight, sa chaîne traverse weighted-bipartite (rien) puis weighted-hypergraph — weight = 1, hérité. Et la plus profonde : ss-pn-philosophers-5-inst::states::s1 ne pose que philo1.think1 = 2 ; philo1.eat1 = 0 et philo1.fork1 = 1 se lisent quand même, parce que la fermeture de l'état traverse son type, qui se lie tard au paramètre petrinet posé au dîner — le type d'un état est le réseau, et le réseau répond à travers lui.",
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
      en: "Citations, unions, late binding — composition is data too",
      fr: "Citations, unions, liaison tardive — la composition est une donnée aussi",
    },
    body: [
      {
        en: "The ⟪citation⟫ first: the dinner does not copy its template — five citations in a collection, and the engine's reader expands each cited window; the members land qualified (philo1.think1…), the data stays in the template, the re-anchored arcs point into the dinner (measured: 15 places, 10 transitions, 25 arcs). The ⟪union⟫ next: a collection can merge other collections — a diagram's vertices are its internal nodes ⊕ its terminal ones — and the enumeration composes.",
        fr: "La ⟪citation⟫ d'abord : le dîner ne copie pas son template — cinq citations dans une collection, et le lecteur du moteur développe chaque fenêtre citée ; les membres atterrissent qualifiés (philo1.think1…), la donnée reste dans le template, les arcs re-ancrés pointent dans le dîner (mesuré : 15 places, 10 transitions, 25 arcs). L'⟪union⟫ ensuite : une collection peut fusionner d'autres collections — les sommets d'un diagramme sont ses nœuds internes ⊕ ses nœuds terminaux — et l'énumération compose.",
      },
      {
        en: "⟪Late binding⟫ carries the schema's rules onto the instances (the ⟪implicits⟫): a member that says nothing still inherits its type. Its most beautiful case is the ⟪parameter⟫. Petrinet-behavior declares a state type refining « petrinet » — a path that does not exist on it; the layer ss-pn-philosophers-5 lays petrinet = pn-philosophers-5; the resolution happens in the reading layer — s1's closure contains the dinner (measured), and a transition of the state space reads the dinner's philo1.take1, generated by the citation without anything being copied.",
        fr: "La ⟪liaison tardive⟫ porte les règles du schéma sur les instances (les ⟪implicits⟫) : un membre muet hérite quand même de son type. Son cas le plus beau est le ⟪paramètre⟫. Petrinet-behavior déclare un type d'état raffinant « petrinet » — un chemin qui n'existe pas chez lui ; la couche ss-pn-philosophers-5 pose petrinet = pn-philosophers-5 ; la résolution se fait dans la couche lisante — la fermeture de s1 contient le dîner (mesuré), et une transition de l'espace d'états lit la philo1.take1 du dîner, générée par la citation sans que rien ne soit copié.",
      },
      {
        en: "Multiple inheritance is data, not an engine function. Petrinet-scheme refines three layers — the bipartite partition, the annotation of the vertices, that of the edges (measured); the weighted-bipartite ⟪diamond⟫ refines two. The core sample walks the branches in the refines order — for weight, the first branch that speaks wins, and a read settled between incomparable sources is an ⟪order conflict⟫: visible as a lint diagnostic, refused in strict staging — and nothing signs it (ADR-0023): to resolve it is to restructure.",
        fr: "L'héritage multiple est une donnée, pas une fonction du moteur. Petrinet-scheme raffine trois couches — la partition bipartite, l'annotation des sommets, celle des arêtes (mesuré) ; le ⟪diamant⟫ weighted-bipartite en raffine deux. Le carottage traverse les branches dans l'ordre des refines — pour weight, la première branche qui parle gagne, et une lecture tranchée entre sources incomparables est un ⟪conflit d'ordre⟫ : visible en diagnostic de linter, refusée en staging strict — et rien ne la signe (ADR-0023) : la résoudre, c'est restructurer.",
      },
    ],
    see: {
      en: "panel ④ — cards S10 (the weighted diamond), S11 (the two-parent type), S12 (the triple inheritance), S13 (the recast base) and S14 (the state that inherits the net).",
      fr: "panneau ④ — cartes S10 (le diamant pondéré), S11 (le type à deux parents), S12 (le triple héritage), S13 (la base refondue) et S14 (l'état qui hérite du réseau).",
    },
  },
  {
    id: "travail",
    label: { en: "8 · Who verifies what", fr: "8 · Qui vérifie quoi" },
    title: {
      en: "Linter and checks: the division of labor, measured",
      fr: "Linter et checks : la division du travail, mesurée",
    },
    body: [
      {
        en: "Two verifiers share the space, and neither sees what the other sees. The ⟪linter⟫ verifies the structure — the memory of our strata: dead references, embeddings, inert late bindings. The ⟪check⟫s carried by the data verify the domain: cycles, duplicates, cardinalities. Measured on the planted defects: a net that refines a nonexistent layer (a typo in refines) is seen by the linter alone (1 RAFFINE/ERREUR, on bad-pert-2); a place that cites an unknown step by ⟪key⟫ is seen by the checks alone (« unknown predecessor », on bad-pert — the linter is blind to designations by keys). The workshop's own space is sound; the defects live in the harness's test spaces, planted to measure who sees what.",
        fr: "Deux vérificateurs se partagent l'espace, et aucun ne voit ce que voit l'autre. Le ⟪linter⟫ vérifie la structure — la mémoire de nos strates : références mortes, plongements, liaisons tardives inertes. Les ⟪check⟫s portés par les données vérifient le domaine : cycles, doublons, cardinalités. Mesuré sur les défauts plantés : un réseau qui raffine une couche inexistante (une faute de frappe dans refines) est vu par le seul linter (1 RAFFINE/ERREUR, sur bad-pert-2) ; une place qui cite par ⟪clé⟫ une étape inconnue est vue par les seuls checks (« prédécesseur inconnu », sur bad-pert — le linter est aveugle aux désignations par clés). L'espace de l'atelier est sain ; les défauts vivent dans les espaces de test du harnais, plantés pour mesurer qui voit quoi.",
      },
      {
        en: "A carried check must also be ABLE to judge: each tag of the ⟪registry⟫ declares its contract — where it judges, which ⟪slot⟫s it must read. A posed check whose slots are unbound is refused as « check vacant » (ADR-0018); in strict staging the carried checks EXECUTE over the candidate, and their refusals come back as « check-trahi » — the constraint composes with the validity. Since ADR-0019 the registry itself is written in the language: the layer check-registry declares the contracts, and the metamodel came home. Since ADR-0020 the bedrock is read-only by protocol, not by convention — a draft claiming a bedrock name is refused (« socle-occupé »), and no edition ever aims at it. The ⟪alias⟫'s price is assumed: the same defect is reported at every view address that designates it.",
        fr: "Un check porté doit aussi pouvoir JUGER : chaque étiquette du ⟪registre⟫ déclare son contrat — où elle juge, quels ⟪slot⟫s il lui faut lire. Un check posé dont les slots ne sont pas liés est refusé comme « check vacant » (ADR-0018) ; en staging strict, les checks portés s'exécutent sur la candidate et leurs refus reviennent comme « check-trahi » — la contrainte compose avec la validité. Depuis l'ADR-0019, le registre lui-même est écrit dans le langage : la couche check-registry déclare les contrats, et le métamodèle est rentré chez lui. Depuis l'ADR-0020, le socle est immuable par protocole, non par convention — un brouillon qui réclame un nom du socle est refusé (« socle-occupé »), et aucune édition ne le vise jamais. Le prix de l'⟪alias⟫ est assumé : un même défaut est rapporté à chaque adresse de vue qui le désigne.",
      },
    ],
    see: {
      en: "panel ② — the Diagnostics & validation fold: the golden reads contract and the verdict, which says what was verified, never « correct ».",
      fr: "panneau ② — repli Diagnostics & validation : le contrat de lectures d'or et le verdict, qui dit ce qui a été vérifié, jamais « correct ».",
    },
  },
  {
    // the third verification floor earns its step — the tests
    // contract, with the seven real expectations of the dinner
    id: "contrat",
    label: { en: "9 · The contract", fr: "9 · Le contrat" },
    title: {
      en: "The tests travel with the layer — the expected is measured, never guessed",
      fr: "Les tests voyagent avec la couche — l'attendu se mesure, il ne se devine pas",
    },
    body: [
      {
        en: "A third verifier was missing: one that freezes reads. A tests block lives in the layer, and each expect writes an ⟪address⟫ and the value it must return — measured, not desired. Here is the dinner's, in full:",
        fr: "Il manquait un troisième vérificateur : celui qui gèle des lectures. Un bloc tests vit dans la couche, et chaque expect y écrit une ⟪adresse⟫ et la valeur qu'elle doit rendre — mesurée, pas désirée. Voici celui du dîner, en entier :",
      },
      {
        code: "tests\n  expect places/philo1.think1/marking = 1\n  expect places/philo1.eat1/marking = 0\n  expect philosophes/philo3/identifier = 3\n  expect pre_arcs/fk2/weight = 1\n  expect positions/philo1.seat/system = \"polar\"\n  expect positions/philo1.seat/x absent\n  expect pre_arcs/fk5/source = @pn-philosophers-5/places/philo5.fork1",
        title: {
          en: "pn-philosophers-5 — the dinner's contract (the seven expectations)",
          fr: "pn-philosophers-5 — le contrat du dîner (les sept attendus)",
        },
      },
      {
        en: "Three forms of expectation: a value (the read must return exactly 1), absent (the read must return null — a polar seat's x descends from the record, never from staging), a reference (the read must resolve the exact address — the arc fk5 points the fifth philosopher's fork). The ⟪contract⟫ travels with the layer — on disk as in memory, in a ⟪citation⟫ as in a refinement — and the validation replays it at every assembly: a betrayed read is an « expectation-betrayed » verdict that refuses the entry, from staging to the last re-freeze.",
        fr: "Trois formes d'attendu : une valeur (la lecture doit rendre exactement 1), absent (la lecture doit rendre null — le x d'un siège polaire descend du record, jamais du staging), une référence (la lecture doit résoudre l'adresse exacte — l'arc fk5 pointe la fourchette du cinquième philosophe). Le ⟪contrat⟫ voyage avec la couche — au disque comme en mémoire, dans une ⟪citation⟫ comme dans un raffinement — et la validation le rejoue à chaque assemblage : une lecture trahie est un verdict « attendu-trahi » qui refuse l'entrée, du staging au dernier re-gel.",
      },
      {
        en: "The Tests panel of the fold (②) shows every expectation — met or betrayed, the read value, and the provenance: which layer carried the read. The rule is the workshop's honesty: the geologist proposes drafts, never truth, and an expectation enters a layer only for a read already seen. Measured is not desired — the contract is signed by the human.",
        fr: "Le panneau Tests du repli (②) montre chaque attendu — conforme ou trahi, la valeur lue, et la provenance : quelle couche a porté la lecture. La règle est celle de l'honnêteté de l'atelier : le géologue propose des brouillons, jamais la vérité, et un attendu n'entre dans une couche que pour une lecture déjà vue. Mesuré n'est pas désiré — le contrat est signé par l'humain.",
      },
    ],
    see: {
      en: "the Tests panel (a formalism's fold, ②) — every expectation replayed against the living space, with its provenance.",
      fr: "le panneau Tests (repli d'un formalisme, ②) — chaque attendu rejoué contre l'espace vivant, avec sa provenance.",
    },
  },
  {
    // the honest floor — measured, not proven, and the limits on
    // display
    id: "preuve",
    label: { en: "10 · Verification", fr: "10 · La vérification" },
    title: {
      en: "Everything is measured, nothing is claimed proven",
      fr: "Tout est mesuré, rien n'est dit prouvé",
    },
    body: [
      {
        en: "The workshop does not claim proofs; it claims measurements. Every observable read of the kernel is compared, byte for byte, to a frozen baseline, and the specification's obligations and conformances (docs/specification.md, O1–O18, C1–C8) are replayed as properties by the harness — 49 assertions in a few seconds, no external call, and any difference is a refusal. A property that passes is a conformance measured today, not a theorem: the vocabulary says verified, never proven.",
        fr: "L'atelier ne revendique pas de preuves ; il revendique des mesures. Chaque lecture observable du noyau est comparée, octet par octet, à une ligne de base gelée, et les obligations et conformances de la spécification (docs/specification.md, O1–O18, C1–C8) sont rejouées comme des propriétés par le harnais — 49 assertions en quelques secondes, aucun appel externe, et toute différence est un refus. Une propriété qui passe est une conformance mesurée aujourd'hui, pas un théorème : le vocabulaire dit vérifié, jamais prouvé.",
      },
      {
        en: "The stratigraphic column — this tutorial's thread — is measured like everything else: same steps, same golden contract, same verifications. 47 layers in the inventory (38 of hierarchy, 9 of views), the template and the dinner counted separately, and the guided tour's fourteen scenarios walk the same space.",
        fr: "La colonne stratigraphique — le fil de ce tutoriel — est mesurée comme tout le reste : mêmes marches, même contrat d'or, mêmes vérifications. 47 couches à l'inventaire (38 de hiérarchie, 9 de vues), le template et le dîner comptés séparément, et les quatorze scénarios de la visite guidée parcourent le même espace.",
      },
      {
        en: "The limits are on display, not hidden: the linter is blind to designations by keys; an intention that no layer formulates is not verified; the ⟪alias⟫ multiplies the reports of one defect. Nothing here claims to be more than it measures.",
        fr: "Les limites sont affichées, pas cachées : le linter est aveugle aux désignations par clés ; une intention qu'aucune couche ne formule n'est pas vérifiée ; l'⟪alias⟫ multiplie les signalements d'un même défaut. Rien ici ne prétend être plus qu'il ne mesure.",
      },
    ],
  },
  {
    // the last floor — the full list of notions, each term a hover
    // tooltip
    id: "glossaire",
    label: { en: "11 · The glossary", fr: "11 · Le glossaire" },
    title: {
      en: "Every notion, on hover — the definition where the word lives",
      fr: "Chaque notion, au survol — la définition là où le mot vit",
    },
    body: [
      {
        en: "Every notion of this tutorial is dotted-underlined where it appears: hover, the definition opens — a definition is cited, not paraphrased. Here is the whole list, thirty-seven notions, each defined in one line; the rest — the filiation, the history, the comparison with the existing — lives on its own page.",
        fr: "Toutes les notions de ce tutoriel sont soulignées de pointillés là où elles apparaissent : survolez, la définition s'ouvre — une définition se cite, elle ne se paraphrase pas. Voici la liste entière, trente-sept notions, chacune définie en une ligne ; le reste — la filiation, l'histoire, la comparaison avec l'existant — vit sur sa propre page.",
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

/** One corpus excerpt, colored by the same rules as the « Language »
 * tab: the spans follow the boundaries the lexer draws. */
function CodeExcerpt({ code, title, language }: { code: string; title: BilingualText; language: Language }) {
  return (
    <figure className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      <figcaption className="border-b border-slate-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {localized({ language, text: title })}
      </figcaption>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-5">
        {code.split("\n").map((line, lineIndex) => (
          <div key={lineIndex}>
            {highlightSourceLine(line).map((span, spanIndex) => (
              <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
                {span.text}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </figure>
  );
}

/** The tutorial as one scrollable page: every step is a section,
 * prose and real excerpts alternate, the continuum's layer names
 * navigate to the workshop. */
export function Tutorial({
  onNavigate,
  language,
}: {
  onNavigate: (layer: string, path: string[]) => void;
  language: Language;
}) {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-lg font-bold text-slate-800">
          {say({
            language,
            en: "The tutorial — layered data in eleven steps",
            fr: "Le tutoriel — les layered data en onze étapes",
          })}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {say({
            language,
            en: "the philosophers' dinner is the running example; every section pairs an idea with the real layer that carries it, and the layer names of the column are clickable",
            fr: "le dîner des philosophes est l'exemple suivi ; chaque section marie une idée à la couche réelle qui la porte, et les noms des couches de la colonne sont cliquables",
          })}
        </p>
      </header>
      {TUTORIAL_STEPS.map((step) => (
        <section key={step.id} className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {localized({ language, text: step.label })}
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-800">
            {localized({ language, text: step.title })}
          </h3>
          <div className="mt-4 space-y-4">
            {step.body.map((block, index) =>
              "code" in block ? (
                <CodeExcerpt key={index} code={block.code} title={block.title} language={language} />
              ) : (
                <p key={index} className="text-sm leading-6 text-slate-700">
                  <NotionText text={localized({ language, text: block })} language={language} />
                </p>
              ),
            )}
          </div>
          {step.id === "glossaire" && (
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
              {Object.keys(GLOSSARY).map((term) => (
                <NotionTip key={term} term={term} language={language} />
              ))}
            </div>
          )}
          {step.id === "continuum" && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="font-mono text-xs leading-6">
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
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                {say({
                  language,
                  en: "Sixteen real layers of the column (out of 42) — measured by the harness, every name is a button.",
                  fr: "Seize couches réelles de la colonne stratigraphique (sur 42) — mesurées par le harnais, chaque nom est un bouton.",
                })}
              </p>
            </div>
          )}
          {step.see && (
            <p className="mt-4 border-l-2 border-slate-300 bg-slate-50 py-1.5 pl-3 text-xs leading-5 text-slate-600">
              {say({ language, en: "To see in the tool: ", fr: "À voir dans l'outil : " })}
              {localized({ language, text: step.see })}
            </p>
          )}
        </section>
      ))}
      <p className="text-[11px] leading-4 text-slate-400">
        {say({
          language,
          en: "The cited numbers are measured by the workshop's standalone harness.",
          fr: "Les chiffres cités sont mesurés par le harnais autonome de l'atelier.",
        })}
      </p>
    </div>
  );
}
