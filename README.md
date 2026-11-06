# Layered Data — l'atelier de conception des formalismes

Un démonstrateur où **les définitions elles-mêmes sont des données** : formalismes
et modèles sont des couches qui se sédimentent (raffinement, héritage,
carottage premier-gagné). Le réseau de Petri s'y dérive du socle des
hypergraphes jusqu'au dîner des cinq philosophes, et son espace d'états
hérite du réseau par liaison tardive. Le modèle vient du papier
*Layered Data: A Modular Formal Definition without Formalisms*
(PNSE'16) ; sa filiation intellectuelle — les prédécesseurs
nommés, des frames aux langages de configuration, et les
métamodélisations comparées
(EMF/Ecore, MOF, multi-niveaux, feature models…) — est établie dans
`docs/filiation.md`.

## Contenu

Le code suit une architecture en oignon, documentée dans
`docs/architecture.md` (les règles de codage, binding pour tout `src/` et
`server.ts`, vivent dans `docs/coding-guidelines.md`) :

- `src/domain/` — le noyau layered-data, pur : l'espace (closures, carottage
  premier-gagné), le langage (tokenizer, parseur, compilateur,
  citations), les checks sémantiques, la validation, les vues (lentilles).
  Il n'importe ni React, ni Node, ni fichier : du calcul pur sur données.
- `src/application/` — les cas d'usage : assemblage du corpus depuis les
  sources, staging des ajouts (le refus d'un candidat casseur), vues
  aplaties, linting.
- `src/infrastructure/` — les effets vers l'extérieur : chargement du
  corpus (glob Vite), client HTTP de la carrière, stockage du code d'accès.
- `src/presentation/` — les composants React : purs dans le rendu, sans
  logique métier.
- `src/App.tsx` — la racine de composition : le noyau y est assemblé,
  les états y vivent, les panneaux (① couches, ② formalisme, ③ lecture,
  ④ point de vue) y sont câblés.
- `formalisms/kernel/` — les 47 couches du socle, une par fichier `.ld`.
- `formalisms/users/` — la carrière personnelle (vide au départ).
- `server.ts` — la carrière : API des couches + géologue IA + statique.
- `tests/` — les sept harnais de vérification : audit, spécification
  exécutable, staging, boucle du géologue, éditeur vivant, atelier
  bilingue, vocabulaire du traité (voir plus bas).
- `vscode/` — l'extension VS Code : coloration syntaxique du langage
  `.ld` (build et installation plus bas).
- `docs/specification.md` — la spécification normative du noyau
  (obligations O1–O18, conformité C1–C8, théorèmes deux-régimes
  T1–T3), rendue exécutable par
  `tests/specification-properties.mts`.
- `docs/filiation.md` — la filiation intellectuelle : les
  prédécesseurs nommés (frames et KL-ONE, l'héritage par défaut de
  Touretzky, les prototypes de Self, la cascade CSS, les modules
  Nix, RDF/RDFS), les métamodélisations comparées (MOF, EMF/Ecore,
  modélisation multi-niveaux, XML/JSON Schema, feature models),
  puis la divergence mesurée — le papier fondateur (PNSE'16) y est
  cité.

## Démarrage

```bash
npm install
cp .env.example .env          # puis éditez API_TOKEN
npm run serve                 # carrière (API 127.0.0.1:8791) + atelier avec rechargement à chaud (localhost:5173, proxy /api)
npm run dev                    # l'atelier seul, avec rechargement à chaud
npm run build && npm run serve:prod # l'atelier construit, servi par la carrière
npm test                       # non-régression du noyau (voir plus bas)
npm run check:structure        # équilibre JSX/tsx (filet, sans compilateur)
```

## Coloration syntaxique dans VS Code

L'extension déclarative vit dans `vscode/` : grammaire TextMate
(`syntaxes/ld.tmLanguage.json`) et manifeste, sans dépendance ni
compilation. Détails dans `vscode/README.md`.

```bash
# essayer sans installer, depuis la racine du dépôt :
code --extensionDevelopmentPath=vscode

# empaqueter le .vsix (vsce via npx, depuis le dossier de l'extension) :
cd vscode && npx @vscode/vsce package

# installer (le .vsix pré-construit est fourni dans vscode/) :
code --install-extension vscode/layered-data-0.2.0.vsix
```

Après toute modification de la grammaire, re-générez le `.vsix` avant
installation. Le harnais `node tests/vscode-checks.mts` valide la
grammaire contre tout le corpus `.ld`.

## L'API de la carrière

Le code d'accès passe dans l'en-tête `x-access-code` (le `Authorization:
Bearer <API_TOKEN>` de compatibilité reste accepté). Toutes les routes le
demandent et rendent du JSON, sauf indication.

| Route | Effet |
| --- | --- |
| `GET /api/whoami` | 200 avec code valide, 401 sinon |
| `GET /api/layers` | `{ layers: [{ name, builtIn }] }` — socle + couches des visiteurs |
| `GET /api/layers/:nom` | `{ name, builtIn, source }` — la couche `.ld` |
| `PUT /api/layers/:nom` | pose une couche visiteur (403 sur le socle, 400 nom invalide) |
| `POST /api/generate` | corps `{ prompt }`, réponse **texte brut** : la couche en langage |

L'ancienne API `api/formalismes` reste servie à l'identique (liste,
lecture, pose, effacement) : c'est un alias d'héritage, les nouvelles
intégrations parlent `api/layers`.

Le socle (les 47 couches du corpus) est en lecture seule : `PUT` et
`DELETE` y répondent 403 — et depuis l'ADR-0020, la règle vit dans le
protocole lui-même, pas seulement à la porte de la carrière : staging et
édition portent la signature du socle et refusent eux-mêmes d'y
toucher (« socle-occupé », « socle-édité »). Le vocabulaire du produit
suit le traité de l'ADR-0021 : trois strates, un seul récit.

## Le géologue et le contrat

Le prompt système de `/api/generate` embarque l'état de l'atelier, lu sur
le disque à chaque appel : le manifeste des données en strates (raffinement,
carottage premier-gagné, citations, lentilles), la colonne stratigraphique
complète (une ligne `layer … refines …` par couche du socle, plus les
couches des visiteurs), un exemple complet du corpus et le contrat de
tests. L'erreur amont (clé refusée, modèle inconnu, quota épuisé) est
rendue telle quelle dans la réponse, jamais muette.

**Le géologue propose, le staging juge** : chaque proposition de
`/api/generate` est vérifiée côté serveur par le staging même de
l'atelier (syntaxe, cible inconnue, attendus trahis…) ; un refus
revient au modèle avec ses verdicts, jusqu'à `PEN_MAX_ATTEMPTS`
propositions (3 par défaut). `PEN_STRICT_CONFLICTS=1` arme le bras
strict (ADR-0017, retiré comme sémantique par l'ADR-0023) : le
géologue ne peut plus proposer une lecture que l'ordre des refines
tranche entre sources incomparables — la résoudre, c'est
restructurer, jamais signer. `PEN_STRICT_CHECKS=1` arme le
second bras strict (ADR-0018) : les checks portés par la candidate
s'exécutent enfin, et le géologue ne peut plus proposer une couche que
ses propres contraintes refusent (« check-trahi »). Depuis l'ADR-0019,
le registre des checks est lui-même une couche du socle
(`formalisms/kernel/check-registry.ld`) : les contrats sont des
données, l'existence d'une étiquette est l'existence dans les
données, et le lint audite la couture (« contrat-sans-algorithme »,
« algorithme-sans-contrat », « contrat-illisible »). La réponse est
toujours une couche stagée : texte brut sur 200, refus parlé sur 422 —
et le staging du navigateur reste juge en dernier ressort.

Le contrat de tests : les attendus (`expect … = …`, `expect … absent`)
voyagent avec la couche et se rejouent à la validation ; un attendu trahi
devient un verdict « attendu-trahi ». Protocole : **le géologue propose,
jamais la vérité — les attendus se mesurent, ils ne se devinent pas**.

## Vérification

Sept fronts, tous sous Node nu (type stripping natif) — la CI
(`.github/workflows/ci.yml`) rejoue exactement la même chaîne que
`npm run verify` :

0. **Le typage strict** (`npm run typecheck`) : `tsc --noEmit` sur les
   deux configurations — `tsconfig.json` (l'atelier : `src`, sans
   types Node, pour que le domaine reste pur) et `tsconfig.node.json`
   (le côté serveur : `server.ts`, les harnais, `vite.config.ts`,
   avec `@types/node`). Node ne vérifie jamais les types au
   chargement : ce front-là ne vit que dans le compilateur.
1. **Le harnais d'audit** (`npm run test:audit`) rejoue le noyau
   (`src/domain/`) sur le corpus entier, dump toutes les lectures
   observables — stats de validation, verdicts, diagnostics, closures,
   clés visibles, lectures, clés spéciales — et les compare au bit près à
   `tests/baseline-kernel.txt` (725 déclarations, 7 tests, 0 trahi,
   0 verdict). Aucune évolution du noyau ne passe sans dump identique.
2. **La spécification exécutable** (`npm run test:specification`,
   `tests/specification-properties.mts`) vérifie les obligations O1–O18
   et exigences C1–C8 de `docs/specification.md` comme des propriétés —
   des mesures de conformance, pas des démonstrations formelles :
   closures (dédoublonnage, nœud propre premier, diamant mesuré),
   lectures (premier-gagné, statuts), clés, ancres, immutabilité
   (indépendance de l'ordre d'appel, invariance par permutation des 47
   couches), garde de cycle, liaison tardive, désucrage (ordre
   topologique, idempotence), protocole d'invalidation exact — et,
   depuis l'ADR-0023, les théorèmes de l'algèbre deux-régimes (§14 :
   confluence, conservativité, monotonie), mesurés retrait par
   retrait et croissance par croissance.
3. **Les checks de staging** (`npm run test:staging`,
   `tests/staging-checks.mts`) figent le protocole des ajouts : brouillon
   sain accepté et appliqué, syntaxe cassée refusée à l'étape « syntaxe »,
   cible inconnue refusée (« cible-inconnue »), attendu trahi
   (« attendu-trahi »), conflit d'ordre refusé en mode strict sans
   exception (« conflit-d'ordre », ADR-0017 retiré comme sémantique
   par l'ADR-0023), check posé mais incapable de juger refusé
   (« check-vacant », ADR-0018), et checks portés exécutés en mode
   strict (« check-trahi »). Brouillon réclamant un nom du socle
   refusé (« socle-occupé », ADR-0020) — le vol nommé, la pièce
   forgée jamais jugée.
4. **La boucle du géologue** (`npm run test:pen-loop`,
   `tests/pen-loop-checks.mts`) vérifie la boucle côté serveur
   (`src/application/penLoop.ts`, géologue injecté — hors ligne) : refus
   syntaxique puis correction acceptée, verdicts en français au modèle,
   budget épuisé (3 refus), géologue muet refusé, proposition raffinant
   une couche d'utilisateur acceptée quand la carrière est dans le contexte,
   proposition réclamant le nom d'une couche du socle refusée
   (« socle-occupé », ADR-0020) puis corrigée vers un raffinement accepté.
5. **Les checks de l'éditeur vivant** (`npm run test:editor`,
   `tests/editor-checks.mts`) figent le protocole des éditions
   (`src/application/edition.ts`) : la couche vivante quitte le
   contexte le temps du jugement, le staging revalide corpus +
   suppléments entiers et rejoue les attendus des autres couches
   vivantes ; l'édition acceptée remplace l'arbre en place, déclare
   l'écriture — le touch invalide la fermeture de la couche ET celle
   de l'enfant qui la lit (O18 à travers la chaîne de raffinement) ;
   renommage refusé, couche glissée dans l'édition refusée, attendu
   trahi d'une autre couche refusé (l'espace reste intact), édition
   visant le socle refusée (« socle-édité », ADR-0020) — et sans
   le touch, la fermeture mémoïsée sert l'ancienne chaîne en silence :
   le protocole est obligatoire.
6. **Les checks de l'atelier bilingue** (`npm run test:i18n`,
   `tests/i18n-checks.mts`) vérifient la parité des deux langues :
   l'anglais par défaut, le français en miroir. Les codes du noyau
   (statuts, kinds, étapes) restent stables dans les données —
   `renderMessage`/`kernelLabel` les habillent dans la langue de
   l'atelier ; chaque surface pédagogique (glossaire, tutoriel,
   scénarios, notes de vue, rôle des 47 couches, diagnostics,
   instructions du géologue) porte ses deux textes, mesurés par le
   harnais. Les formalismes `.ld` du corpus restent dans leur langue.
7. **Les checks du vocabulaire du traité** (`npm run test:terminology`,
   `tests/terminology-checks.mts`) figent le traité de l'ADR-0021 :
   trois strates, un seul récit. Les mots de l'informatique gardent
   leur nom adopté (staging, linter — « la linteuse » est retirée),
   les marques ⟪…⟫ citent le glossaire dans la langue de chacun, et
   le récit vit chez le géologue (socle, carrière, colonne
   stratigraphique) ; les mots retirés (la plume, l'armoire, le
   tronc, la colonne vertébrale) n'apparaissent dans aucune chaîne
   rendue, mesuré.

`npm test` lance les sept harnais ; `npm run verify` lance toute la
chaîne (typage, structure, harnais, build). La spécification normative
vit dans `docs/specification.md` (texte en français : le vocabulaire
observable du produit l'est aussi).

Sous Node, le harnais importe le domaine directement (type stripping
natif) ; sous Vite, l'atelier charge le même domaine — le corpus ne vit
qu'une fois.

## Garde-fous

- Le serveur écoute sur `127.0.0.1` par défaut ; ne changez `HOST`
  que derrière un reverse-proxy authentifié.
- Aucune clé n'est embarquée : le géologue sort seulement si
  `MISTRAL_API_KEY` est posée dans l'environnement ou le `.env`.
