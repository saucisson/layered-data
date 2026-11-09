# Layered Data — VS Code

Coloration syntaxique et lint du langage de couches `.ld` : actes
(`layer`, `refines`, `then`, `extend`, `override`, `abstract`,
`bind`, `check`, `expect`, `absent`), clés spéciales
(`specification`, `defaults`, `checks`, `bindings`, `tests`, `note`,
…), adresses `@couche/chemin`, chaînes, nombres, listes `[a, b]`,
liaisons `slot -> valeur` et commentaires `//`. Le pliage suit
l'indentation (le langage vit de l'indentation, aucune accolade
n'est colorée : elle est refusée par la langue).

La coloration est déclarative : aucun runtime, aucune dépendance,
rien à compiler. Le linter, lui, **réutilise le noyau** — le même
TypeScript que l'atelier (`src/domain`, `src/application`), via le
CLI `vscode/linter.mts` : l'analyse n'est jamais réécrite, elle ne
peut pas dériver.

## Essayer (sans installation)

Depuis la racine du dépôt :

    code --extensionDevelopmentPath=vscode

## Installer

Depuis la racine du dépôt :

    make vscode-install

La cible empaquette le `.vsix` (nécessite `vsce`, récupéré via `npx`
sans installation préalable ; le nom du fichier reprend la version
du manifeste, ex. `layered-data-0.3.0.vsix`) puis l'installe :
`code --install-extension vscode/layered-data-<version>.vsix`.
Équivalent manuel : `cd vscode && npx --yes @vscode/vsce package`.

## Vérifier

    node tests/vscode-checks.mts

Le harnais valide la grammaire (JSON bien formé, expressions
rationnelles qui compilent, chaque ligne de chaque `.ld` du corpus
porte ses scopes attendus) et le linter (le CLI répond en JSON, zéro
diagnostic sur le corpus sain, et sur des corpus cassés : erreur de
syntaxe localisée à sa ligne, attendu trahi souligné sur sa ligne
`expect`, surcharge implicite sur son fichier, l'assemblage qui
continue quand la syntaxe est saine ailleurs). Il est volontairement
absent de `npm test` : purement additif, l'entrée se câble à
l'intégration.

## Le linter

Trois passes, toutes dans le noyau :

1. **syntaxe**, fichier par fichier (tout `.ld` sous `formalisms/`),
   localisée à la ligne — le parseur porte ses numéros ;
2. **assemblage** du corpus noyau (`assembleLayeredDataKernel`,
   exactement les couches que l'application assemble, dans l'ordre) ;
3. **verdicts** de la validation : surcharge implicite, déclaration
   fantôme, attendu trahi (localisé sur sa ligne `expect`), liaison
   morte, ombre non déclarée… — ce que l'application refuse
   d'exécuter, l'éditeur le souligne en rouge.

Une erreur de syntaxe dans le noyau suspend les passes 2 et 3
(l'assemblage ne peut pas juger un texte qu'il ne peut pas lire) ;
une erreur de syntaxe ailleurs (par exemple `formalisms/users/`)
ne suspend rien. Le CLI répond en JSON :

    node vscode/linter.mts --root . [--language fr] [--kernel <src>]

`--kernel` désigne le dossier `src/` du noyau : par défaut celui à
côté du script (un checkout du dépôt) ; une extension installée en
`.vsix` vit hors du dépôt, elle passe donc le `src/` de l'espace de
travail ouvert.

L'extension (`extension.js`, CommonJS sans dépendance) lance ce CLI
à l'ouverture et à l'enregistrement des `.ld` (frappe : 400 ms de
débounce), et mappe la réponse en diagnostics. Le binaire Node vient
du réglage `layered-data.nodePath` (défaut `node`) : le CLI a besoin
du type stripping natif de Node (22.18+), le même runtime que les
harnais du dépôt. Les messages de syntaxe viennent du tokenizer du
noyau, les verdicts sont rendus dans la langue du réglage
`layered-data.language` (défaut `fr`). La commande
`Layered Data: Lint the corpus` relance à la demande.

## L'autocomplétion

L'extension enregistre un fournisseur de complétion sur le langage
`layered-data` (déclencheurs `@` et `/`). Il lance le CLI
`vscode/completion.mts` — même noyau, même `--kernel` que le linter —
avec le **texte du document sur stdin** (les frappes non enregistrées
comptent) et la position du curseur en arguments :

    node vscode/completion.mts --root . --line <n> --character <c> [--language fr] [--kernel <src>] < source.ld

Le CLI assemble le corpus noyau pour obtenir l'espace, puis appelle
`completeLanguage` (`src/domain/language/completion.ts`) et répond en
JSON : `{ version, language, completions: [{ label, kind, detail }] }`,
`kind` parmi `act`, `layer`, `key`. Quatre contextes, lus dans le
texte avant le curseur :

1. `@…` — les noms de couches après `@`, les segments de chemin
   après `@couche/…` (lus dans les clés de l'espace à cette adresse) ;
2. `refines` / `then` — les noms de couches (y compris celles que le
   document édité déclare lui-même) ;
3. `expect …` — les clés de la couche courante au chemin tapé ;
4. ailleurs — les actes du bloc courant (`layer` à la marge, les
   actes membres et les clés spéciales plus profond).

Un corpus qui n'assemble pas dégrade la complétion (actes et couches
seuls) sans jamais échouer : la complétion ne juge pas, c'est le
linter qui rapporte. L'extension mappe les kinds en `Keyword`,
`Module` et `Field`, et reste silencieuse si le CLI échoue.

## L'analyse statique, ensuite

Les diagnostics sont le refus d'assembler ; viennent ensuite les
services de lecture : survol d'une adresse (la fermeture, le
gagnant), go-to-definition sur les `@couche/chemin` — le noyau
expose déjà la résolution. Le pas suivant est un serveur de langue
qui importe `src/domain` en continu.
