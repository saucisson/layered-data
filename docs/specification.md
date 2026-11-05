# Formalisation des données en strates (Layered Data) — spécification sémantique normative

> **Status in this repository.** This is the normative reference for
> `src/domain/`: what the kernel *does*, implementation-independent.
> The obligations below (O1–O18) and the conformance requirements
> (C1–C8) are executable: `tests/specification-properties.mts`
> proves them as properties over the bedrock corpus and over dedicated
> spaces, and `tests/audit-kernel.mts` freezes C1–C3 as a
> byte-identical baseline dump. Bracketed names refer to kernel
> operations; in the TypeScript domain they read: `[closure]` →
> `Space.closure`, `[computeClosure]` → `Space.computeClosure`,
> `[raw]` → `Space.raw`, `[rawValue]` → `Space.rawValue`,
> `[resolveRef]`/`[resolveEntry]` → `Space.resolveReference` /
> `Space.resolveRefinementEntry`, `[anchorsAt]` →
> `Space.anchorsAt`, `[read]` → `Space.read`, `[desugar]` →
> `desugarLayer`, `[runChecks]` → the check registry walk of
> `domain/checks.ts`, `[closure, touch]` → the memo journal of
> `Space`. The document is kept in French: its vocabulary (masqué,
> fournit, transparent, absent, attendu-trahi…) is the observable
> vocabulary of the product. Its measured references live in
> `tests/` (the audit harness and its baseline).

**Statut.** Spécification normative, extraite du noyau de référence (layered-data, noyau
TypeScript extrait de l'atelier). Elle décrit ce que le noyau *fait* — la fermeture par
adresse, la re-racination, le premier-gagné, les masques, le désucrage, les checks,
l'invalidation — indépendamment de toute implantation. Tout noyau conforme doit
satisfaire les obligations du §12. Les termes **DOIT**, **DOIVENT**, **PEUT** suivent
leur sens normatif usuel. Les détails cités entre crochets renvoient aux fonctions du
noyau : `[closure]`, `[resolveRef]`…

**Périmètre.** La sémantique de *lecture*. Hors périmètre : le registre des checks de
domaine (contenu, non mécanisme), les lentilles de rendu, l'interface de l'atelier.

---

## 1. Modèle des données

Un **espace** est un ensemble nommé de **couches**. Une couche est un arbre de valeurs dont
les clés sont des chaînes. Les valeurs sont :

| Valeur | Rôle |
| --- | --- |
| dictionnaire (dict) | nœud intérieur ; seul un dict peut être *vu* comme nœud |
| scalaire (nombre, booléen, chaîne) | valeur de feuille |
| `null` (slot abstrait) | **transparent** : présent mais muet, la lecture continue |
| `MASK` | **opaque** : présent et muet, la lecture s'arrête (§7) |
| `Ref(anchor, path)` | désignation *à travers* les couches (liaison tardive) |
| `LRef(layer)` | désignation *d'une couche entière* |
| `AddrView(layer, path)` | vue d'adresse, produit interne des lectures (non posé dans les données) |

Un ensemble **fixe de clés spéciales** structure chaque nœud et n'est jamais vu comme
contenu : `refines`, `implicits`, `specification`, `anchors`, `defaults`, `checks`. Toute
autre clé est un **membre** du nœud.

**Conventions.** L'ordre d'insertion des clés est significatif et préservé par toute
implantation. Un nœud dict dont une clé vaut `null` *déclare* la clé sans la fournir.

---

## 2. Adresses et brut

Une **adresse** est un couple `(couche, chemin)` — chemin = suite de clés, éventuellement
vide (racine de couche).

**Brut** `[raw(l, p)]` : descend le chemin `p` dans la couche `l`. Le brut rend :

- le nœud atteint, si c'est un dict ;
- `MASK`, si le nœud atteint (ou un intermédiaire) est `MASK` ;
- `null` dans tous les autres cas : clé absente, intermédiaire non-dict, ou nœud feuille
  **scalaire**.

**Obligation O1.** Un scalaire n'est jamais visible comme nœud : le brut d'une adresse
scalaire est `null`. Les scalaires ne vivent que comme *valeurs de clés*.

**Brut de valeur** `[rawValue(l, p, k)]` : la première valeur **non résolue** de la clé `k`
trouvée dans la fermeture de `(l, p)` (§3), en ignorant les valeurs `null`. Utilisé par le
désucrage pour recopier des entrées sans les résoudre (§9).

---

## 3. Fermeture

La **fermeture** `C(l, p)` d'une adresse est la liste **ordonnée, dédupliquée** des adresses
qui la définissent, de la plus spécifique à la plus générique. Elle est le cœur de la
sémantique : toute lecture la parcourt dans cet ordre (§6).

**Calcul** `[computeClosure]` :

1. **Base.** Soi-même `[l, p]` si `raw(l, p) ≠ null`. Puis les **membres du père** : pour
   chaque `[pl, pp]` de `C(l, p')` (où `p'` = `p` sans son dernier segment), le candidat
   `[pl, pp + dernier]`, s'il n'est pas l'adresse courante et si son brut est non nul.
2. **Entrées.** Le premier membre de la base dont le nœud porte `refines` fournit les
   **entrées** ; ce membre est le `entriesFrom`. Le **porteur de résolution**
   (`entriesHolder`) — la re-racination, voir §4 — en dépend.
3. **Ordre de sortie** :
   a. le nœud propre (s'il existe) ;
   b. la **chaîne des refines** : chaque entrée résolue (§4) pousse sa cible, puis toutes
      les sources de la fermeture de la *vue* désignée (ombre **d'union**, §8), puis,
      récursivement, les refines de cette vue ;
   c. les membres du père restants, **sans ré-expansion**, en fin de liste.

**Obligations.**

- **O2 (spécificité).** L'ordre de sortie encode la spécificité : propre nœud, puis chaîne
  des refines dans l'ordre déclaré, puis membres du père. C'est la sémantique de R3 : dans
  une liste `refines`, le spécifique DOIT précéder le générique.
- **O3 (dédoublonnage).** Une adresse apparaît au plus une fois ; la première insertion
  gagne.
- **O4 (membres du père).** Les membres du père ne sont jamais ré-expansés : le refines d'un
  membre du père ne descend pas d'un cran.
- **O5 (garde de cycle).** Si le calcul de `C(a)` se ré-entre sur `a`, l'entrée ré-entrée
  rend une liste vide et les frames en cours depuis ce point sont **taintées** : leurs
  résultats NE DOIVENT PAS être mémoïsés (§11), car un résultat issu d'une garde de cycle
  dépend de l'ordre d'appel.

**Fermeture au niveau couche.** `C(l, [])` suit le même algorithme ; ses `refines` sont les
LRefs de la racine. L'espace DOIT être **acyclique en LRef au niveau couche** (pré-requis
du désucrage, §9) ; les cycles dans les types sont neutralisés par O5.

---

## 4. Résolution des désignations et re-racination

**Entrée** `[resolveEntry]` :

- `LRef(c)` → la cible ET la vue désignée sont `(c, [])`.
- `Ref(a, q)` → résolu par `resolveRef` contre le porteur ; le résultat DOIT être une
  adresse (une vue) — un scalaire rend l'entrée sans objet (ignorée).

**Recherche d'ancre** `[resolveRef(ref, holder)]`. Une `Ref(anchor, path)` se résout contre
un **porteur** `(hl, hp)` :

1. Pour `i` de `|hp|` à `0` (préfixes du plus long au plus court) : si `anchor` ∈
   `anchorsAt(hl, hp[:i])` (§5), le préfixe courant est retenu ; sinon on continue.
2. **Ancres racine** (`i = 0`) : si `anchor` est le nom d'une couche de la fermeture
   `C(hl, [])`, la position est la **vue courante** `(hl, [])` — la désignation reste dans
   la chaîne ; sinon c'est une **couche étrangère** et la position est `(anchor, [])`.
3. **Ancres profondes** (`i > 0`) : la position est `(hl, hp[:i])` — la référence est
   **re-racinée dans la couche lisante**, jamais dans la couche d'origine du membre. C'est
   le mécanisme qui fait descendre un champ spécifique d'une couche le long de toute sa
   chaîne de raffinement (le poids du diamant arrive par la seconde voie, les conteneurs
   croisés de `bd` par la première — la note de `weighted-bipartite` en est la trace
   mesurée).
4. **Chemin** : pour chaque clé `k` de `ref.path`, lire `read(pos, k)` :
   - `null` → échec total (« chemin interrompu »), la résolution rend `null` ;
   - `MASK` → la résolution rend `MASK` (propagé) ;
   - vue `AddrView` → la position saute à la vue (la liaison est **tardive** : la cible
     peut être posée plus bas dans la pile) ;
   - scalaire → le scalaire est le résultat (fin du chemin).

**Porteur d'entrée (re-racination des entrées).** Pour les entrées `refines` de la fermeture,
le porteur DOIT être déterminé ainsi `[computeClosure]` : si le membre `entriesFrom` vit
dans la couche courante (`b.layer == l`), le porteur est ce membre tel quel ; sinon, si son
chemin a plus d'un segment **et** que son père a un brut non nul dans la couche `entriesFrom`,
le porteur est re-raciné comme `(l, b.path)` — l'entrée se résout *dans la couche lisante* ;
sinon le porteur est l'adresse courante `(l, p)`.

**Obligation O6 (liaison tardive).** Un `Ref` peut viser un chemin inexistant au moment de sa
pose ; la résolution se fait dans la couche lisante, au moment de la lecture. Aucune
résolution n'est figée à la pose.

---

## 5. Ancres

`anchorsAt(l, p)` : l'**union ordonnée**, sur les sources de `C(l, p)`, du dernier segment
du chemin de chaque source — ou du **nom de couche** pour une source racine `[anchorsAt]`.
Une source en cours de calcul (frame ouverte) ne contribue pas (prudence de cycle).

**Obligation O7.** Les ancres d'une adresse sont l'union des ancres de sa fermeture (R10) ;
un fragment porte son nom comme ancre, sinon il est invisible depuis une instance qui
remonte vers le socle.

---

## 6. Lecture premier-gagné

`read(l, p, k)` `[read]` : parcourt `C(l, p)` **de la plus récente à la plus ancienne**
source, c'est-à-dire dans l'ordre de sortie de la fermeture :

1. Si le nœud source est `MASK` → rend `MASK` immédiatement (§7).
2. Si le nœud est un dict portant `k` avec valeur non `null` :
   - valeur `MASK` → rend `MASK` ;
   - dict → rend `AddrView(l, p + [k])` : la clé ouvre une **sous-adresse**, lue dans la
     couche courante (et non dans la couche source) ;
   - `LRef(c)` → rend `AddrView(c, [])` ;
   - `Ref` → résolution contre `(l, p)` (§4) ; rend une vue ou le scalaire résolu ;
   - scalaire → rend le scalaire.
3. Sinon la source est sautée : clé absente = silence, clé `null` = **transparent** (le
   slot abstrait ne fournit rien, la lecture continue).

La première source qui fournit tranche : c'est le **premier-gagné**. L'ordre des `refines`
est donc le sens (O2) : premier source définissant une clé = plus spécifique.

**Obligation O8.** Les statuts observables d'une lecture sont exactement : `masqué`,
`fournit`, `transparent`, `absent` — dans cet ordre de parcours. Toute implantation DOIT
pouvoir exposer ce scan (l'atelier le fait en panneau ③).

---

## 7. Masques

`MASK` est un **masque opaque** : une valeur (ou sous-arbre) qui court-circuite toute
lecture à son niveau — contrairement à `null`, transparent.

- `read` : un nœud source `MASK` (ou une valeur de clé `MASK`) rend `MASK` *avant* tout
  examen des clés.
- `keys` : une clé dont la lecture rend `MASK` n'est **pas visible**.
- `raw` : propage `MASK` depuis un intermédiaire.

**Obligation O9.** `MASK` n'est jamais un dict et n'est pas sérialisable tel quel ; toute
sérialisation DOIT l'encoder sous une forme dédiée (p. ex. `__mask`). `null` et `MASK` sont
les deux seules valeurs muettes : la première laisse passer, la seconde arrête.

---

## 8. Unions et appartenance

Une **union** est une collection dont les `refines` désignent d'autres collections (R6).
Sa sémantique vit dans la fermeture : par O3-b, la cible poussée entraîne avec elle **toutes
les sources concrètes** de la vue désignée (ombre d'union) — l'appartenance est
l'énumération.

**Appartenance** `[memberOf]` : `val ∈ cont` ssi (a) raccourci : `val` est un enfant direct
de `cont` (même couche, chemin de `val` = chemin de `cont` + une clé), ou (b) le **nœud
concret désigné** par `val` — le premier source de sa fermeture — est identique à celui
désigné par un membre de `cont`.

**Obligations.**

- **O10.** Une union n'est valide que pour des sous-collections à clés disjointes ; la dédup
  est premier-gagné (O3).
- **O11 (R8).** À l'adresse d'une union, toute contrainte de dénombrement exact est
  structurellement illisible : sur une collection aliasée, seul un `minimum` peut être posé
  ; les contraintes exactes passent par un check de domaine définissant ses membres **par
  le type** à travers la vue.

---

## 9. Désucrage

Le désucrage recopie, **sans les résoudre** (liaison tardive préservée, O6), les entrées
`implicits` d'un nœud dans les `refines` de ses enfants non spéciaux `[desugar]` :

1. Parcours en pré-ordre du brut de la couche, ordre d'insertion des clés.
2. Pour chaque nœud : enfants = membres dicts non spéciaux. S'il n'y en a pas, rien.
3. `implicits = rawValue(nœud, "implicits")` — la première valeur **non résolue** par
   premier-gagné, donc **héritée par les modèles**. Liste vide = rien.
4. Pour chaque enfant : créer `refines` s'il est absent, puis ajouter chaque entrée absente
   (égalité structurelle des `Ref`/`LRef`, dédoublonnage).

**Obligations.**

- **O12 (idempotence).** Ré-exécuter le désucrage sur un espace déjà désucré ne change rien.
- **O13.** Le désucrage se fait dans un **ordre topologique des couches** (DFS sur les LRefs
  racines, ordre d'insertion) : les implicits ne peuvent se lier qu'après leurs sources.
- **O14 (R9).** Une collection d'un modèle qui ne raffine pas `collection` a une fermeture
  qui n'atteint jamais la racine des collections : ses bornes seraient lues mais jamais
  vérifiées (check vacant). Toute collection posée DOIT se relier à la racine.

---

## 10. Exécution des checks

Un **check** est une étiquette portée par la clé `checks` d'un nœud, héritée par la
fermeture, résolue par un **registre** externe au mécanisme (R7 : le noyau n'est jamais
modifié pour un formalisme) `[runChecks]` :

1. Marche de la vue aplatie de la couche.
2. À chaque adresse : pour chaque source de la fermeture portant des étiquettes, exécuter
   la fonction du registre, **dédoublonné par (adresse, étiquette)**.
3. Les erreurs sont des messages de données, formatage exact et stable ; l'adresse y est
   préfixée : `couche::chemin — message`.

**Obligation O15.** Une étiquette inconnue du registre est ignorée silencieusement (jamais
d'exception). Une étiquette a **une seule sémantique par registre** : redéfinir `simple`
dans un sous-espace avec un autre sens est une non-conformité à consigner, jamais un usage.

---

## 11. Mémoïsation et invalidation

Les fermetures peuvent être mémoïsées `[closure, touch]`. Toute entrée de mémo emporte :

- sa **liste** (le résultat) ;
- ses **dépendances** : chaque brut `raw(l, p)` lu pendant le calcul, y compris le brut
  propre, collectées dans la frame ouverte (et héritées par la frame parente, y compris
  taintée) ;
- sa **génération**.

**Protocole d'écriture** (`touch(layer, path)`) :

- **addition** d'un chemin : zéro invalidation (rien de mémoïsé ne le consultait) ;
- **suppression / restructure** : déclarer le **père** ;
- **écriture de valeur** : déclarer le **nœud écrit**.

Une entrée est **invalide** ssi un événement postérieur à son calcul **recouvre** une de ses
dépendances : même couche, et le chemin de l'événement est préfixe **exact** du chemin de la
dépendance (les bornes de segments sont explicites : `places` ne recouvre pas `places2`) ;
chemin vide = couche entière. Une entrée qui survit à la vérification re-tampe sa
génération.

**Obligations.**

- **O16.** Sur un espace **immuable**, aucun événement n'est posé et toute entrée est valide
  en O(1) : les résultats sont indépendants de l'ordre d'appel.
- **O17.** Les résultats issus d'une garde de cycle (frame taintée, O5) ne sont pas
  mémoïsés. **Conséquence assumée** : sur un espace *mutable* contenant un cycle de types,
  la fermeture peut dépendre de l'ordre d'appel — les couches de l'espace DOIVENT donc
  être acycliques pour garantir le déterminisme.
- **O18.** Le parent hérite des dépendances de tout ce qu'il lit (fermetures et entrées de
  mémo), sinon son propre mémo est aveugle.

---

## 12. Exigences de conformité

Une implantation est conforme si, sur un espace de référence :

1. **C1 — Fermetures.** Pour chaque adresse de l'espace, la liste de fermeture est
   identique, au composant près, à la référence (ordres O2–O4 inclus).
2. **C2 — Lectures.** Chaque lecture `(adresse, clé)` rend la même valeur **et le même
   statut observable** (O8), `MASK` compris (O9).
3. **C3 — Clés.** `keys` rend la même liste ordonnée, clés masquées exclues.
4. **C4 — Ancres.** `anchorsAt` rend la même union ordonnée (O7).
5. **C5 — Désucrage.** Après désucrage topologique (O13), le brut de l'espace est identique,
   et l'idempotence O12 tient sur un second passage.
6. **C6 — Checks.** Les erreurs de checks sont identiques, ordre et format compris (O15).
7. **C7 — Invalidation.** Pour les trois scénarios de mutation (addition, suppression,
   écriture) : les entrées invalidées sont exactement celles recouvertes par le protocole
   du §11 ; après `touch`, la re-marche d'or est identique à la marche d'or d'origine hors
   la zone mutée.
8. **C8 — Immutabilité.** Sur l'espace immuable, les résultats ne dépendent pas de l'ordre
   d'appel (O16), y compris en présence de cycles de types (O5 : listes vides, non
   mémoïsées).

**Style de preuve recommandé.** La conformité se prouve par **équivalence de dumps
normalisés** sur des espaces dédiés (le protocole DATA/OUT du harnais), complétés par des
tests de propriétés : idempotence du désucrage, invariance des fermetures par permutation de
couches non liées, propagation exacte des `touch` (C7). Un diff d'octets n'est acceptable
que sur des dumps dont la typographie est gelée ; pour tout le reste, préférer le diff
**sémantique** normalisé.

---

## 13. Exemple filout (le diamant, une lecture pas à pas)

Lecture de `wb1::arcsAB::e2::weight` dans le diamant `weighted-bipartite = [bipartite-digraph,
weighted-hypergraph]` :

1. Fermeture de `wb1::arcsAB::e2` : propre nœud `e2`, puis la chaîne des refines — la cible
   re-racinée pousse l'`arcAB_type` de `bd` (conteneurs croisés), puis `edge_type`
   re-raciné dans la chaîne du diamant, où le record **croisé de `bd` arrive en tête**
   (O2 : l'ordre des refines, le spécifique d'abord), puis les membres du père (`e1`,
   l'autre membre, silencieux).
2. `weight` n'est posé ni sur `e2` ni dans le record croisé ; le premier source le
   définissant est `weighted-hypergraph::edge_type` (`weight`, défaut 1) — atteint par la
   **seconde voie** du diamant.
3. La lecture rend `1` : le poids hérité à travers la composition, sans que `wb1` n'ait
   rien déclaré. C'est le scénario mesuré S10, et la raison pour laquelle un nœud de
   jonction déclaré en propre s'auto-réfère et **rétrograde** sa voie (R2) : la re-racination
   (§4.3) l'empêcherait d'arriver en tête.

---

## 14. Précisions tranchées par la mesure (normatives)

Deux points laissés ouverts par le texte ci-dessus ont été tranchés par un passage de
conformité mesuré (oracle indépendant écrit depuis la présente spécification) et sont
désormais normatifs :

- le désucrage recopie les `implicits` dans les **enfants dicts non spéciaux directs** du
  nœud porteur — et l'implicits est lui-même lu **par premier-gagné dans la fermeture**,
  donc hérité par les modèles (§9.3) ;
- une entrée invalidée par `touch` l'est **si et seulement si** une de ses *dépendances*
  (pas son adresse propre) est recouverte par l'événement — une fermeture de `vertices`
  dépend de `places` et s'invalide avec elle (§11).

---
