# Changelog

## 2.23.0 — l'atelier bilingue

L'atelier parle deux langues : **l'anglais par défaut, le français à
un clic** (bouton EN|FR de l'en-tête, choix mémorisé, détection de la
langue du navigateur à la première visite). Les formalismes `.ld` du
corpus restent dans leur langue — seule la surface de l'atelier est
traduite.

- `src/domain/messages.ts` — les faits structurés du domaine :
  `MessageFact {code, params}` rendu par `renderMessage` dans la
  langue de l'atelier, `kernelLabel` habille les codes stables
  (statuts, kinds, étapes — jamais traduits dans les données),
  `parseText` pour les compositions éphémères. `Verdict.detail` et
  `Diagnostic.detail` deviennent `fact` : le harnais d'audit
  bilingue garde la moitié française **octet-identique** à v2.22.0
  (preuve de continuité).
- `src/presentation/i18n.ts` — `say`, `localized`, `labelOf`,
  `editionRefusalLabel` : la langue voyage par props `language`
  explicites, de `App.tsx` jusqu'à chaque feuille (pas de contexte
  React).
- `src/presentation/` — glossaire (30 entrées), tutoriel (11 étapes,
  colonne vertébrale de 17 notes), scénarios S1–S14, rôle des 46
  couches, notes de vue, noms de formes, panneaux (formalisme,
  diagnostic, validation, cascade, éditeur, composition, armoire) :
  tout porte ses deux textes.
- `server.ts` — les instructions de la plume parlent les deux
  langues (`penInstructions`, anglais par défaut), VERSION 2.23.0.
- `tests/i18n-checks.mts` — sixième harnais : la parité des deux
  langues est mesurée (messages du noyau, vocabulaire, glossaire,
  tutoriel, scénarios, rôles, diagnostics, instructions de la
  plume). Les données pédagogiques vivant dans des `.tsx` que Node
  ne strip pas sont lues à la source par un mini-parseur de
  littéraux.
- `index.html` — titre anglais par défaut.

## 2.22.0 — l'éditeur vivant

Une couche vivante se réécrit **en place**, sous le même tribunal
que l'entrée : elle quitte le contexte le temps du jugement, le
staging la rejuge, l'atelier relit l'espace.

- `src/application/edition.ts` — le cas d'usage pur de l'édition :
  `stageLayerEdition` (la couche éditée sort du contexte vivant,
  les autres couches vivantes restent et leurs attendus sont
  rejoués, corpus + suppléments revalidés entiers) et
  `applyStagedEdition` (l'arbre stagé remplace l'ancien en place,
  puis l'écriture est **déclarée** — le touch du protocole
  d'invalidation). Deux gardes complètent le tribunal : renommer ou
  retirer la couche n'est pas l'éditer, glisser une couche nouvelle
  dans une édition n'est pas un ajout. `rewriteLivingAddition`
  garde la source vivante à jour pour les stagings suivants.
- L'invalidation mesurée : le touch de la couche entière invalide
  la fermeture mémoïsée de la couche **et celle de l'enfant qui la
  lit** (O18 à travers la chaîne de raffinement) ; sans le touch,
  la fermeture mémoïsée sert l'ancienne chaîne **en silence** —
  `staleMemoKeys()` ne dit rien, le protocole est obligatoire.
- `src/presentation/layerEditor.tsx` + câblage `src/App.tsx` — le ✎
  de ① : bouton sur chaque couche vivante non-tronc (le tronc reste
  en lecture seule), éditeur source avec verdicts et refus parlés ;
  une édition acceptée re-vise le graphe des raffinements
  (`RefinementDag.retargetLayer`), met à jour le bloc de langage et
  compte une relecture — les mémos de ③ servent la vérité vivante,
  jamais une fermeture périmée.
- `tests/editor-checks.mts` — 24 assertions : édition saine acceptée
  (la chaîne élargie `@wb1 then @kahn-scheme` entre dans la
  fermeture, invalidation de l'enfant mesurée, corpus intact),
  syntaxe cassée refusée, attendu trahi **d'une autre couche**
  refusé (« attendu-trahi », espace intact), renommage refusé,
  couche glissée refusée, et la preuve que le touch est
  indispensable. `npm test` enchaîne désormais les cinq harnais.
- README et `docs/architecture.md` : six fronts de vérification.

## 2.21.0 — boucle IA vérifiée côté serveur

La plume ne livre plus jamais une couche non vérifiée : **la plume
propose, le staging juge, le refus revient au modèle avec ses
verdicts.**

- `src/application/penLoop.ts` — le cas d'usage pur de la boucle :
  `composeVerifiedLayerDraft` (propose → stage → refuse avec les
  raisons ou accepte), plume injectée (`PenPropose`), refus formatés
  en français avec le vocabulaire observable du noyau (« cible-
  inconnue », « attendu-trahi », étape « syntaxe »…), budget
  d'essais, proposition vide refusée d'office.
- `server.ts` — `/api/generate` boucle : chaque proposition est
  jugée par le staging même de l'atelier, sur le tronc (assemblé une
  fois au démarrage) **plus les plumes des visiteurs** (relues à
  chaque appel — une plume écrite il y a dix secondes reste
  raffinable) ; un refus voyage au modèle avec ses verdicts, jusqu'à
  `PEN_MAX_ATTEMPTS` (3 par défaut, `.env.example`). La réponse est
  toujours une couche stagée : texte brut sur 200, refus parlé sur
  422 ; les erreurs d'infrastructure (clé absente, amont injoignable)
  gardent leurs statuts (500/502) — une `PenInfraFailure` typée, pas
  une exception muette. Le prompt système annonce la vérification au
  modèle ; le staging du navigateur reste juge en dernier ressort.
- `tests/pen-loop-checks.mts` — 17 assertions, plumes factices
  déterministes : refus syntaxique puis correction acceptée (le
  feedback exact parcourt la boucle), budget épuisé (3 refus
  « cible-inconnue »), attendu trahi corrigé, plume muette refusée,
  proposition raffinant une plume d'utilisateur acceptée quand
  l'armoire est dans le contexte vivant — refusée sinon. `npm test`
  enchaîne désormais les quatre harnais.
- Preuve intégrée hors ligne : un amont factice (serveur local
  répondant au protocole de complétion) montre la boucle de bout en
  bout — deux appels, le second portant exactement le refus
  « cible-inconnue » en français, réponse 200 avec la couche
  acceptée et stagée.
- Le serveur importe désormais la couche application (`corpus.ts`,
  `penLoop.ts`) sous type stripping natif — l'infrastructure câble
  les cas d'usage, l'oignon reste droit. Audit : identique au bit
  près.

## 2.20.0 — typage strict et CI

Le type devient un front de vérification à part entière : `tsc
--noEmit` en strict couvre désormais **tout** le dépôt, et une CI
rejoue la chaîne complète.

- Deux configurations de typage : `tsconfig.json` (l'atelier — `src`
  seul, `types: []` : aucun global Node ne peut fuiter dans le
  domaine, la pureté de l'oignon devient une vérification) et
  `tsconfig.node.json` (le côté serveur — `server.ts`, les harnais,
  `vite.config.ts`, avec `@types/node`). Le premier couvrait déjà
  `src` en strict ; le second est nouveau, ainsi que
  `@types/node`/`@types/react` en devDependencies (le typage de
  l'atelier ne pouvait pas compiler autrement).
- `npm run typecheck` lance les deux ; `npm run verify` enchaîne
  typage, structure, les trois harnais et le build.
- La CI (`.github/workflows/ci.yml`) rejoue exactement cette chaîne
  sur Node 22 : types stricts, structure des panneaux, audit au bit
  près, spécification exécutable, staging, build. Sans lockfile
  (dépôt livré en zip), la CI résout les versions épinglées du
  package.json.
- Passe de propreté stricte sur les fichiers jamais compilés : le
  `catch (error: any)` du parseur devient un `catch (error)` avec
  cast explicite, les harnais typent leurs observations avec le
  `ReadObservation` du domaine.
- Honnêteté de mesure : le bac à sable de l'atelier n'installe aucun
  paquet (aucun `tsc` local) — le front typage ne s'exécute que dans
  la CI (ou en local après `npm install`) ; les trois harnais, eux,
  restent vérifiés ici à chaque modification. Comportement du noyau :
  inchangé (audit identique au bit près).

## 2.19.0 — spécification exécutable

Le comportement du noyau n'est plus seulement audité au bit près : il
est **spécifié puis prouvé**. La spécification sémantique normative
rejoint le dépôt (`docs/specification.md` : obligations O1–O18,
exigences de conformité C1–C8) et devient exécutable.

- `docs/specification.md` — le texte normatif (en français : le
  vocabulaire observable du produit l'est), avec la correspondance des
  noms entre crochets de la spécification et symboles du code
  (`[closure]` → `Space.closure`, `[desugar]` → `desugarLayer`, …).
- `tests/specification-properties.mts` — 43 assertions : closures sur
  tout le tronc (dédoublonnage, nœud propre premier, diamant §13
  mesuré), lectures (premier-gagné, statuts masqué/fournit/
  transparent/absent, MASK), clés, ancres recomposées
  indépendamment, immutabilité (indépendance de l'ordre d'appel,
  invariance par permutation — l'assemblage des 46 couches en ordre
  inversé donne 0 différence), garde de cycle (ré-entrée, frames
  taintées non mémoïsées, ordre observable — la conséquence assumée),
  liaison tardive, désucrage (ordre topologique, ruling implicits
  par premier-gagné, idempotence), protocole touch (invalidation
  exacte, addition zéro-invalidation, bornes de segments).
- `tests/staging-checks.mts` — 12 assertions : le protocole des
  ajouts figé (brouillon sain accepté et appliqué, syntaxe cassée à
  l'étape « syntaxe », « cible-inconnue », « attendu-trahi »).
- `npm test` devient la chaîne complète : `test:audit` (dump au bit
  près inchangé), `test:specification`, `test:staging`.
- Chaque attente « mesurée » a été lue sur le noyau en marche avant
  d'être figée — même discipline que la baseline : audit identique au
  bit près (725 déclarations, 7 tests, 0 trahi, 0 verdict).

## 2.18.0 — refactoring en oignon

Le code change de peau, pas de comportement : l'atelier passe du
monolithe (`App.tsx` de 6 700 lignes) à une architecture en oignon
documentée (`docs/architecture.md`, règles de codage dans
`docs/coding-guidelines.md`).

- Le noyau ldv2 vit dans `src/domain/` (pur : aucun import React, Node
  ou fichier), les cas d'usage dans `src/application/`, les effets dans
  `src/infrastructure/`, le rendu dans `src/presentation/` (une vingtaine
  de composants purs), `src/App.tsx` (1 300 lignes) reste la racine de
  composition.
- Le code est intégralement en anglais, sans abréviations, à paramètres
  nommés ; les notions métier sont des types nominaux (marqués), les
  erreurs attendues sont des valeurs typées (résultats), pas des
  exceptions. L'interface visible reste en français — c'est le produit.
- Le corpus déménage : `formalismes/noyau` → `formalisms/kernel`,
  `formalismes/utilisateurs` → `formalisms/users`.
- Le serveur devient `server.ts`, en anglais, même protocole au bit
  près (le vocabulaire JSON de l'API d'héritage `api/formalismes` reste
  français : c'est un protocole observable).
- Le harnais d'audit vit dans le dépôt (`tests/audit-kernel.mts`,
  baseline `tests/baseline-kernel.txt`) : `npm test` compare toutes les
  lectures observables du noyau au bit près. L'ancien harnais généré
  (`tests/kernel-dump.mts`, 101 Ko) disparaît.
- Non-régression prouvée : dump identique au bit près à la baseline
  après chaque étape (725 déclarations, 7 tests, 0 trahi, 0 verdict).

## 2.17.0 — nettoyage archéologique

Le dépôt ne raconte plus son histoire en marge du code : chaque tournée
de correctif vit ici, et lui seul.

- Les marqueurs de fabrication (tours datés, runs, références au papier,
  règles, journal en pied d'atelier) sont retirés de l'interface, du
  corpus, du serveur et du README ; le nom `ldv2` du noyau reste — c'est
  son nom, pas un marqueur.
- Les chiffres de mesure restent ; les histoires de correctifs migrent
  dans ce journal.
- `CANVAS.md` et `extraire-canvas.mjs` disparaissent : `src/App.tsx` est
  la source de vérité, le pipeline canvas→source était archéologique.
- Le README est réécrit propre : contenu, démarrage, API (avec
  `api/formalismes` marquée alias d'héritage), harnais, garde-fous.
- Non-régression prouvée : le dump de toutes les lectures observables du
  noyau sur le corpus entier est identique au bit près à la baseline
  (725 déclarations, 7 tests, 0 trahi, 0 verdict).

## 2.16.5 — la plume connaît l'atelier

La demande IA renvoyait un « bad gateway » muet : l'erreur amont
(Mistral) n'était pas dite. Le 502 embarque désormais le statut et le
corps de la réponse amont — clé refusée, modèle inconnu, quota épuisé se
lisent dans l'atelier, à la place de la source de la proposition.

Et surtout : le prompt système embarque automatiquement l'état de
l'atelier, lu sur le disque à chaque appel — le manifeste des données en
strates (raffinement, carottage premier-gagné, citations, lentilles), la
colonne vertébrale complète (une ligne `layer … refines …` par couche du
tronc, plus les plumes des visiteurs avec leurs sources), un exemple
complet du corpus (le template pn-philosophers-1) et le contrat de tests.
Mesuré : ~8 800 caractères de contexte, 46 lignes de colonne vertébrale.

## 2.16.4 — le proxy parle le protocole de l'atelier

Le code d'accès du site était refusé même correct : le frontal de
l'atelier envoie le code dans l'en-tête `x-access-code` et appelle
`api/layers`, alors que le serveur n'acceptait que `Authorization:
Bearer` et n'exposait que `api/formalismes`. Le serveur parle désormais
le protocole de l'atelier : `GET /api/layers`, `GET/PUT /api/layers/:nom`
(plume visiteur, 403 sur le tronc), et `POST /api/generate` en réponse
texte brut. Le code d'accès passe dans `x-access-code` (le `Bearer`
de l'API de compatibilité reste accepté) ; `api/formalismes` reste
servie à l'identique.

## 2.16.3 — le .env est lu

Le serveur lisait les variables dans `process.env`… mais rien ne chargeait
le fichier `.env` : Node ne le fait pas de lui-même. Le jeton posé au
fichier restait lettre morte et l'API répondait 401. Le serveur parse
désormais `.env` au démarrage (l'environnement réel reste prioritaire)
et signale au démarrage : `.env` lu ou absent, jeton par défaut encore
en place.

## 2.16.2 — le style embarque

Le style de l'atelier est écrit en classes Tailwind ; le canvas les
compile automatiquement, mais le projet local ne l'embarquait pas :
l'atelier s'affichait sans style. Le projet embarque désormais Tailwind
v4 via `@tailwindcss/vite` — même rendu en dev comme en build. Audit :
les 193 classes uniques de l'atelier sont toutes des utilitaires Tailwind
standard, aucune feuille de style maison n'est nécessaire.

## 2.16.1 — le plantage au chargement

Le premier build de v2.16 plantait au chargement (`TypeError: can't
access property Symbol.iterator`) : la table ligne → adresse de la
cascade ne connaissait pas l'acte `expect` introduit par le contrat de
tests — un acte sans bloc, que le balayage prenait pour un conteneur et
parcourait sur `undefined`. Corrigé : les sept `expect` du dîner sont
indexés à leur scène, cliquables dans l'onglet « Langage ». Mesuré : le
balayage couvre les 46 couches, 672 lignes, sans exception.

## 2.16 — le tronc sur le disque, le contrat de tests, le tutoriel

- **Le tronc quitte le bundle** : chaque couche vit dans
  `formalismes/noyau/<nom>.ld`, lu au démarrage — même contenu, même
  déroulement, mais adressable fichier par fichier ; le serveur sert
  le tronc en lecture seule et l'armoire des visiteurs à côté.
- **Le contrat de tests** : le bloc `tests` et l'acte `expect`, avec les
  trois formes d'attendu — valeur, `absent`, référence. La validation le
  rejoue à chaque assemblage ; une lecture trahie est un verdict. Et
  l'IA propose la plume, jamais la vérité : les attendus se mesurent
  dans l'atelier, ils ne se devinent pas.
- **Le tutoriel pas-à-pas** : la plume expliquée geste par geste —
  `layer`, `refines`/`then`, `extend`/`override`/`abstract`, le `@`
  des chemins absolus, `check`, `note` — chaque extrait est la couche
  réelle du corpus ; le contrat gagne son étape, et chaque notion
  reçoit son infobulle : la définition au survol, le glossaire vit en
  dernier étage.
