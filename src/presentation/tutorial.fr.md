# Le dîner des philosophes, en strates

Ce tutoriel va du concret au formel, et le code porte la démonstration. Chaque listing ci-dessous est **calculé par l'application à l'affichage** : la ⟪fermeture⟫ d'une couche du corpus du tutoriel, résolue sur place, ligne par ligne. Chaque ligne porte sa parenté (le badge de la couche qui fournit la valeur, ou déclare le slot) ; cliquez-la : la carte dit d'où vient la valeur, ou la chaîne des types ⟪raffine⟫. Le langage des fichiers `.ld` est le langage du géologue : une ligne par geste, la mise en page structure, pas de JSON.

Le corpus du tutoriel est **dédié** : dix couches, plus simples que le ⟪socle⟫ de l'atelier (47 couches), et sa colonne stratigraphique se lit d'un trait :

```text
graph ─ petrinet (métamodèle) ─ philosophers (template) ─ philosophers-5 (modèle)
  └── automaton ─ state-space (métamodèles) ─ philosophers-5-state-space (modèle)
```

## Les données à représenter

Un réseau de Petri, le dîner des philosophes. Un philosophe : trois places (`think`, `eat`, `fork`), deux transitions (`take`, `release`) ; un jeton dans `think`, un dans `fork`. Le dîner en pose cinq autour de la table : chaque `fork` est partagé avec le voisin de droite, pris par son `take`, rendu par son `release`. Mesuré : 15 places, 10 transitions, 25 arcs, chaque arc de ⟪poids (weight)⟫ 1.

En parallèle, l'espace d'états du même dîner : un automate dont les états sont des marquages du réseau et l'alphabet ses transitions — `graph` → `automaton` → `state-space` → `philosophers-5-state-space`.

Métamodèle, modèle, contrainte, paramètre : dans la suite, tout cela est une ⟪couche⟫.

## Ce qu'en font les outils d'aujourd'hui

EMF/ECore : le métamodèle est un modèle (EClass, EAttribute, EReference — Ecore lui-même s'écrit en Ecore, la partie réflexive est la bonne). L'instance vit dans un fichier XMI ; les contraintes vivent en OCL, un autre langage ; le dessin vit dans un framework dédié (GMF, Graphiti). Quatre mondes, quatre langages : chaque passage traduit, et quand le métamodèle change, les copies dérivent. Et la définition ne se compose pas finement : un EPackage en importe un autre, une EClass en étend une autre — pas de restriction incrémentale superposée, pas de template citable, pas d'instance partielle restée lisible.

Les travaux plus récents gardent la coupe : Langium sépare grammaire, validation et génération ; MPS sépare structure et langages d'édition ; les langages à schéma (JSON Schema, LinkML) valident, ils ne raffinent pas.

Les layered data répondent par un seul geste : une seule espèce de donnée (la couche), un seul acte de composition (⟪raffine⟫), une seule lecture (la fermeture traversée, ⟪premier-gagné⟫). La définition incrémentale par notions finement composables devient la règle, et le même modèle se relit sous plusieurs formalismes : c'est ce que les deux chaînes ci-dessus montrent, sur le même dîner.

## Le socle minimal

Trois couches ne déclarent aucun parent : elles descendent de rien.

### record — la dalle

Une ⟪specification⟫ vide, un `record` nu : le plancher du langage, ce que tout type raffinera.

```ldflat:record
```

### collection — la collection à clés

Quatre ⟪slot⟫ ouverts (`type`, `container`, `minimum`, `maximum`) : l'appartenance se dit par ⟪clé⟫, localement, et le type dit ce qu'un membre doit raffiner.

```ldflat:collection
```

Cliquez la ligne `abstract minimum` : la carte dit « declared by collection, provided by none » — un slot ouvert reste lisible ; ne rien poser, c'est ⟪hériter⟫.

### check-registry — les contrats des checks

Depuis ADR-0019, le contrat d'une étiquette de ⟪check⟫ est une donnée : où elle juge (`level`), quels slots il lui faut lire. Le ⟪registre⟫ du tutoriel réduit aux deux étiquettes génériques que le corpus pose.

```ldflat:check-registry
```

## graph — le métamodèle de base

Des sommets et des arcs : deux collections, un type par sorte, `identifier` abstrait — chaque instance le posera. Chaque arc pointe ses deux bouts (`source`, `target`), l'annotation `container` dit où vivent les bouts. Deux étiquettes de check posées **ici** descendent dans tout raffinement : `containers` (les bouts d'un arc sont des sommets du graphe), `cardinality` (une collection respecte ses bornes).

```ldflat:graph
```

Cliquez la ligne `type` sous `vertices` : la carte montre la chaîne des types raffinés, du type du graphe au `record` de la dalle. Les notions en jeu : ⟪adresse⟫ (couche, chemin), ⟪clé⟫, ⟪contrat⟫.

## petrinet — le réseau de Petri

⟪Raffine⟫ le graphe, renomme les strates : les sommets deviennent des places et des transitions, le type d'une place porte un `marking` (le nombre de jetons), le type d'un arc porte un `weight` (encore abstrait). Les ⟪alias⟫ : `vertices = places ∪ transitions` (⟪union⟫ par l'acte `then`), `edges = arcs` — les checks du graphe continuent de juger le réseau sans savoir qu'il en est un.

```ldflat:petrinet
```

## philosophers — le template instantiable

Un philosophe seul. Le vocabulaire est typé (`specification/think`, `eat`, `fork`, `take`, `release`) : les types sont des **données**, le métamodèle est une couche comme les autres. Les membres raffinent leurs types et posent leurs valeurs : `identifier`, `marking`. La ⟪contrainte⟫ se lit dans le listing : `weight = 1` posé sur `arc_type` au niveau de la déclaration — aucun modèle ne le réécrit, tout arc qui raffine le type en hérite.

```ldflat:philosophers
```

## philosophers-5 — le modèle

Le modèle cite le template cinq fois : cinq ⟪citation⟫s dans la collection `philosophes` (`identifier` 1 à 5) — le lecteur développe, les membres du template atterrissent qualifiés (`philo2.think`), la donnée reste dans le template. Les trois conteneurs portent chacun une équation d'⟪union⟫ ; l'anneau se referme sur les fourchettes partagées : `fk_i` prend la fourchette du philosophe i pour le `take` du philosophe i+1, `rf_i` la lui rend — modulo 5. Le contrat du modèle se porte en données : la cardinalité (`minimum = maximum = 5`, jugée par le check `cardinality` posé par `graph`) et les attendus (`tests/expect`), rejoués par la validation à l'assemblage.

```ldflat:philosophers-5
```

Cliquez la ligne `weight` de `fk2` : la gagnante est `philosophers`, à travers le type — personne ne l'a écrite dans le modèle.

## automaton — l'autre lecture du graphe

Le même `graph`, relu comme un automate : les sommets deviennent des états, les arêtes des transitions, plus un alphabet (une collection de symboles). Deux ⟪alias⟫ suffisent : `vertices = states`, `edges = transitions`. Un ⟪point de vue⟫ est une couche comme les autres — et une ⟪lentille⟫ dessinera le même dîner dans un autre formalisme sans le réécrire.

```ldflat:automaton
```

## state-space — l'espace d'états paramétré

Raffine l'automate, **paramétré par le réseau** : le slot `net` raffine la couche `petrinet` entière — personne ne le pose ici. Le type d'un état raffine le slot : chaque marquage du réseau se lira dans l'état. Et la liaison (`binding_type`) pointe les transitions **à travers** le slot : ⟪liaison tardive⟫, résolue par la couche qui lit, jamais par celle qui écrit. Le ⟪paramètre⟫ est une adresse comme les autres.

```ldflat:state-space
```

## philosophers-5-state-space — le second modèle

Une ligne d'écriture suffit à tout l'espace : `override net = @philosophers-5` (⟪surcharger⟫ un slot d'un ⟪Ref⟫). Puis un état posé : `initial` ne pose que son delta — `philo1.think marking = 2`, un jeton de plus — le reste descend du réseau à travers le type d'état. Et une liaison posée : `b1` désigne la transition `philo1.take` du dîner, générée par la citation, liée tard.

```ldflat:philosophers-5-state-space
```

## Le geste de lecture : le carottage

Lire une ⟪adresse⟫, c'est traverser sa fermeture, de la couche la plus récente à la plus ancienne : le ⟪carottage⟫. La première valeur trouvée gagne (⟪premier-gagné⟫) ; un trou n'est pas une erreur — ne rien poser, c'est ⟪hériter⟫. Dépliez le listing du dîner, cliquez la ligne `marking` de `philo3.fork` : la carte montre la gagnante (`philosophers`, le template) et le nombre de sources consultées. Cliquez la ligne `abstract x` d'un état : « declared by petrinet, provided by none » — le slot ouvert du type d'état, que le réseau remplit.

Tout ce tutoriel n'a employé que ce geste : écrire peu, hériter le reste, lire par carottage. Le ⟪conflit d'ordre⟫ n'apparaît pas ici : les couches du tutoriel ne se contredisent jamais ; l'atelier le montre sur le ⟪socle⟫.

## Aller plus loin

- L'atelier (`#workshop`) : le corpus noyau et son vrai dîner, les quatre panneaux, la ⟪carrière⟫ des couches.
- La hiérarchie complète (`#hierarchy`) : le graphe des raffinements du socle.
- Créer un formalisme (`#creation`) : toute entrée passe par le staging.
- Comprendre un formalisme (`#formalism`) : la source, la fermeture aplatie, les lentilles.

Le glossaire déplie chaque notion citée dans cette page ; l'atelier dit le reste.
