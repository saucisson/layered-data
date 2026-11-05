# Filiation intellectuelle

Le mécanisme central de l'atelier — héritage par défaut, ordre de
spécificité, lecture par chaînes de délégation — n'est pas né ici. Il
refait, en le mesurant, des gestes que la représentation des
connaissances connaît de longue date, et cette page nomme ses
prédécesseurs — pour l'honnêteté du récit, pas pour la caution d'un
nom. La valeur ajoutée du projet est ailleurs : une spécification
normative vérifiée par propriété, des contrats mesurés, un protocole
d'écriture assistée. L'aveu de la filiation fait partie de la rigueur.

## 1. Le mécanisme central a une histoire

### Les frames et les réseaux sémantiques

Les systèmes de frames (Minsky, *A Framework for Representing
Knowledge*, 1974) puis les réseaux sémantiques typés — KL-ONE
(Brachman & Schmolze, *An Overview of the KL-ONE Knowledge
Representation Language*, 1985) — posent déjà tout le geste : des
concepts reliés, des slots portés par défaut, une lecture qui descend
le réseau quand la valeur locale manque. Le carottage premier-gagné
est une sémantique de frames rendue totale : la fermeture d'une
adresse est la chaîne de délégation, la lecture rend la première
valeur posée — et la lecture est totale : elle termine sur tout
espace sans cycle en LRef (pré-requis du désucrage, §9), les cycles
de types étant neutralisés par la garde (O5) — vérifié par
propriété, pas espéré.

### L'héritage par défaut, mathématiquement

Touretzky (*The Mathematics of Inheritance Systems*, MIT Press, 1986)
a formalisé l'héritage par défaut : quel réseau, quel ordre de
spécificité, quelle réponse unique — le pingouin est un oiseau, les
oiseaux volent, les pingouins ne volent pas. La question de 1986
n'était pas de savoir si la spécificité devait trancher, mais quelles
règles donnaient une réponse unique à un réseau ambigu. C'est un
chapitre du raisonnement non monotone : Reiter (*A Logic for Default
Reasoning*, Artificial Intelligence, 1980) et la circonscription de
McCarthy (*Circumscription — A Form of Non-Monotonic Reasoning*,
Artificial Intelligence, 1980) en posent la logique, Brewka
(*Nonmonotonic Reasoning*, Cambridge University Press, 1991) en fait
le tour. L'atelier
répond avec la donnée : l'ordre de spécificité n'est pas une heuristique
du moteur, c'est la liste `refines` de la couche qui le porte — le
conflit d'ordre est tranché par la donnée, jamais par le code
(ADR-0017) — et la lecture termine sur tout espace sans cycle (garde
de cycle O5, vérifiée par propriété).

### Les mixins, les traits et CLOS : la linéarisation

L'héritage multiple des langages à classes a déjà payé le diamant, et
l'a soldé par la **linéarisation** : le CLOS (Bobrow, Gabriel, Keene &
Kiczales, *Common Lisp Object System Specification*, 1988) calcule un
ordre total des superclasses — monotone, documenté, calculé par le
moteur ; les mixins (Bracha & Cook, *Mixin-Based Inheritance*,
OOPSLA/ECOOP 1990) en font la granularité, les traits (Schärli,
Ducasse, Nierstrasz & Black, *Traits: Composable Units of Behaviour*,
ECOOP 2003) la composition sans copie. Le geste est identique :
plusieurs sources, un ordre, la première qui parle. Deux différences :
la linéarisation du CLOS est **calculée par le moteur** depuis la
déclaration, quand ici l'ordre est **posé dans la donnée** (la liste
`refines`), lu tel quel — et le conflit d'ordre entre sources
incomparables est refusé en mode strict (ADR-0017), quand CLOS en
sélectionne un silencieusement. Et le protocole à méta-objets
(Kiczales, des Rivières & Bobrow, *The Art of the Metaobject
Protocol*, MIT Press, 1991) ouvrait déjà le moteur lui-même comme une
donnée éditable — la filiation la plus proche du registre des checks
(ADR-0019), dont l'atelier retient le geste et laisse la
machinerie réflexive.

### Les prototypes : Self

Les langages à prototypes — Self (Ungar & Smith, *Self: The Power of
Simplicity*, 1987) — effacent la classe : des objets qui délèguent
aux objets, des chaînes de délégation qui portent les valeurs par
défaut. Le continuum de l'atelier est un monde à prototypes : le
dîner raffine son type sans opération d'instanciation, un formalisme
n'est qu'une couche jamais concrétisée jusqu'au bout. La différence :
la délégation de Self est un mécanisme d'exécution (le *lookup* se
calcule à chaque envoi), la nôtre une lecture déterministe par
adresses sur un espace immuable — la même filiation, une autre
discipline.

### La cascade CSS

La cascade CSS fusionne des déclarations par origine, spécificité et
ordre de source — un héritage par défaut sur des propriétés,
aujourd'hui codifié par le W3C (CSS Cascading and Inheritance). Le
geste est identique : des sources conciliables, un ordre total, le
plus spécifique qui parle. La différence : les règles de la cascade
vivent dans chaque engin de rendu, codées une fois par
implémentation ; ici l'ordre vit dans la donnée et la lecture est une
— fermeture puis premier-gagné — mesurée sur le diamant pondéré de la
hiérarchie.

### Les modules Nix

Le système de modules de Nix compose des configurations : des options
typées, des fonctions de fusion, des priorités (`lib.mkOverride`) —
des déclarations concurrentes réconciliées par construction. Le geste
est identique. La différence : Nix a un langage dédié au
rehaussement des valeurs ; l'atelier n'a pas de seconde sémantique —
la fusion, c'est la lecture, et elle est la même du schéma au rendu.

### Les langages de configuration : CUE, Jsonnet, Kustomize

Les langages de configuration posent le geste industriel du projet :
schéma et valeurs dans une seule langue, des couches qui se composent.
CUE (van Lohuizen — la documentation de *cuelang.org* en tient lieu
de spécification) fusionne types et valeurs dans un seul treillis :
la combinaison est associative, commutative, idempotente — les
contraintes de sources différentes se composent sans ordre, et le
conflit est une erreur. Jsonnet (*Design Rationale* et *Language
Reference*, jsonnet.org) pense déjà son objet comme une pile de
couches : l'héritage `A + B` empile les couches de `B` sur celles de
`A`, `self` est à liaison tardive — le vocabulaire de l'atelier, avec
des opérateurs de fusion explicites (`+`, `+:`, `super`).
Kustomize (le projet *kubernetes-sigs/kustomize*, documenté sur
kubernetes.io) en fait le geste à l'échelle industrielle : des bases,
des surcouches, des patchs à fusion stratégique — sans théorie. Le
geste est identique. La différence est le sens de la fusion : CUE
*unifie* — commutatif, le conflit refuse ; l'atelier *trie* — le
premier-gagné tranche, l'ordre posé dans la donnée. L'histoire pèse
sur ce choix : GCL, la langue de configuration de Google dont CUE
descend, avait choisi un héritage par surcharge, et sa complexité a
rendu l'outillage prévu intractable. L'atelier répond à la même mise
en garde par la mesure : le mode strict (ADR-0017) refuse les
conflits d'ordre non signés, et la non-commutativité est un prix
affiché (§3) — le pari reste celui de GCL, tenu par des contrats
mesurés plutôt que par une sémantique commutative.

### RDF et RDFS

RDF/RDFS est le plus proche en esprit : tout est triple,
`rdfs:Class` est une ressource, le schéma vit dans le même espace que
les données — les classes sont des instances qui s'éditent. La
différence : le monde ouvert de RDF (l'absence d'information n'est pas
une information), le raisonnement en couches (RDFS puis OWL — *OWL 2
Web Ontology Language*, W3C, 2012), et pas
de premier-gagné strict sur un chemin — chaque superposition a posé
ses débats connus. SHACL (*Shapes Constraint Language*, W3C, 2017)
approche au plus près le geste de l'atelier — la contrainte posée
dans le même espace que la donnée — mais reste un langage de
validation dédié, lu par un validateur, pas une lecture.
L'atelier fait le choix opposé : adresses strictes,
lecture totale et déterministe, ordre porté par la donnée — et il
n'infère rien.

## 2. Les métamodélisations

### La tour M0–M3 : MOF, UML, EMF/Ecore

L'OMG structure la modélisation en niveaux : M3 (le MOF, qui se
définit lui-même), M2 (les métamodèles), M1 (les modèles), M0 (les
instances). Le mur : l'instanciation est la seule relation
inter-niveaux — un modèle ne raffine pas son métamodèle, il s'y
conforme, et chaque niveau a son outillage. EMF/Ecore en est
l'implémentation dominante : Ecore se définit par lui-même (un EClass
est une instance d'EClass), et l'écosystème est immense — OCL pour
les contraintes, Xtext pour les langages, Sirius pour les éditeurs
graphiques. Le tutoriel dit son projet contre cette tour : ni
classes, ni métamodèle codé en dur — le noyau interprète des données.
Ici, la frontière entre déclaration et contenu n'est pas un niveau
ontologique : c'est une convention d'adressage dans un seul espace.

### La réponse du terrain : modélisation multi-niveaux

Le mur des niveaux a été vu, et creusé : la modélisation
multi-niveaux d'Atkinson et Kühne (l'instantiation profonde, la
*potency*) outillée par Melanee ; MPS (JetBrains), auto-hébergé, qui
définit ses concepts dans ses propres concepts ; Kermeta, qui
métaprogrammait Ecore. Ces travaux assouplissent la tour. Le continuum
la démonte : il n'y a pas de niveaux du tout — seulement des couches
et des adresses, et la même opération de lecture du haut vers le bas.

### Les schémas de validation : XML Schema, JSON Schema

XSD (W3C) et JSON Schema (IETF) décrivent des formats : le schéma
d'un côté, l'instance de l'autre, un validateur entre les deux — et
aucun héritage entre le schéma et la donnée qu'il contraint. La
contrainte vit à côté de la donnée. Dans l'atelier, schéma, instance,
contrainte et rendu sont des couches de la même langue : la validation
est une lecture, la contrainte est portée par la donnée, et le
validateur ne change jamais quand un nouveau formalisme entre.

### L'héritage de classes

Les langages à classes séparent la classe de l'instance. L'héritage
simple ne compose pas les dimensions ; l'héritage multiple se heurte
au diamant — à quoi remonte `weight` quand deux parents le posent ?
Les classes répondent par des règles du langage ; l'atelier répond
par la donnée : l'ordre de la liste `refines` tranche, la première
branche parle — mesuré sur le diamant pondéré de la grande hiérarchie,
et le conflit d'ordre est refusé sans signature en mode strict
(ADR-0017).

### Les feature models : FODA

Les feature models (Kang et al., *Feature-Oriented Domain Analysis*,
CMU SEI, 1990) posent la variabilité comme donnée : des features en
arbre, des groupes ET/OU, des cardinalités — le modèle d'un produit
est un arbre de choix contraints. Leurs sémantiques ont été
formalisées depuis : Czarnecki & Eisenecker (*Generative Programming:
Methods, Tools, and Applications*, Addison-Wesley, 2000) pour la
composition, Batory, Sarvela & Rauschmayer (*Scaling Step-Wise
Refinement*, IEEE TSE, 2003) pour le raffinement par étapes. Le papier
de 2016 traitait déjà les
feature models comme des strates ; le socle charge aujourd'hui de la
même façon les automates (`automaton-scheme.ld`), les réseaux de
Kahn (`kahn-scheme.ld`) et les réseaux de Petri jusqu'au dîner des
philosophes — chaque formalisme du papier, une famille de couches.

## 3. Ce que l'atelier ajoute — et ce qu'il ne fait pas

### Ce qu'il ajoute, mesuré

- **Une seule écriture, une seule lecture.** Le schéma, l'instance,
  la contrainte et le rendu sont des couches ; la fermeture puis le
  premier-gagné les lisent avec la même opération, du formalisme à la
  donnée, sans saut de niveau.
- **L'ordre comme sémantique.** Le conflit d'héritage est tranché par
  la donnée (la liste `refines`), jamais par le moteur — et le refus
  de conflit non signé est mesuré (ADR-0017).
- **Une spécification normative vérifiée par propriété.** Les
  obligations O1–O18
  et conformités C1–C8 de `docs/specification.md` sont vérifiées comme
  propriétés (49 assertions, `tests/specification-properties.mts`) —
  des mesures de conformance, pas des démonstrations formelles ;
  l'audit du noyau est octet-identique à sa ligne de base (725
  déclarations comparées à chaque passage).
- **Des contrats portés par les données.** Les checks voyagent dans
  les couches (ADR-0018), le registre des checks est lui-même une
  couche (ADR-0019), le socle est immuable par protocole (ADR-0020) —
  la vérification est de la donnée, pas du code.
- **Un protocole d'écriture assistée.** Le géologue propose, le
  staging juge : la proposition est une couche stagée, jamais une
  vérité, et le refus est parlé.
- **Tout est donnée.** Les 47 couches du socle sont des fichiers
  `.ld` lus par le même noyau que les couches des visiteurs — le
  métamodèle lui-même, ici, ne s'écrit pas : il se charge.

### Ce qu'il ne fait pas — et le dit

- **Il n'infère pas.** La lecture n'est pas un raisonnement : pas de
  subsumption, pas de monde ouvert, pas de satisfiabilité — ce que
  les logiques de description font, l'atelier ne le tente pas.
- **Il n'a pas d'OCL.** Les contraintes sont des checks génériques
  portés par les données — mesurés, composés, moins expressifs
  qu'une logique de contraintes complète.
- **Il n'a pas d'écosystème.** EMF a vingt ans d'outils et
  l'adoption de l'industrie ; l'atelier a sept harnais et un
  tutoriel.
- **Il paie des prix affichés.** Le prix de l'alias (un défaut
  rapporté à chaque adresse de vue qui le désigne), le linter aveugle
  aux désignations par clés — des limites
  documentées dans le tutoriel, pas des découvertes à venir.

## 4. Le papier fondateur

Alban Linard, Benoît Barbot, Didier Buchs, Maximilien Colange, Clément
Démoulins, Lom Messan Hillah, Alexis Martin : *Layered Data: A Modular
Formal Definition without Formalisms*, in Proceedings of the
International Workshop on Petri Nets and Software Engineering 2016
(PNSE'16), co-located with the 37th International Conference on
Application and Theory of Petri Nets and Concurrency (Petri Nets 2016)
and ACSD 2016, Toruń, Pologne, 20–21 juin 2016, CEUR Workshop
Proceedings, Vol. 1591, p. 287–306 — en accès libre sur
<https://ceur-ws.org/Vol-1591/> (version archivée :
<https://hal.sorbonne-universite.fr/hal-01353944>).

Le présent atelier descend directement de ce papier : le modèle —
fermeture, premier-gagné, unions, masques, citations, liaison tardive —
y est défini, et le socle de 47 couches en est la continuation : les
automates, les réseaux de Kahn et le dîner des philosophes y vivent
comme données.
