# Layered Data — VS Code

Coloration syntaxique du langage de couches `.ld` : actes (`layer`,
`refines`, `then`, `extend`, `override`, `abstract`, `bind`, `check`,
`expect`, `absent`), clés spéciales (`specification`, `defaults`,
`checks`, `bindings`, `tests`, `note`, …), adresses `@couche/chemin`,
chaînes, nombres, listes `[a, b]`, liaisons `slot -> valeur` et
commentaires `//`. Le pliage suit l'indentation (le langage vit de
l'indentation, aucune accolade n'est colorée : elle est refusée par
la langue).

Déclaratif pur : aucun runtime, aucune dépendance, rien à compiler.

## Essayer (sans installation)

Depuis la racine du dépôt :

    code --extensionDevelopmentPath=vscode

## Installer

Empaquetage en `.vsix` (nécessite `vsce`) puis
`code --install-extension layered-data-0.1.0.vsix`.

## Vérifier

    node tests/vscode-checks.mts

Le harnais valide la grammaire (JSON bien formé, expressions
rationnelles qui compilent, chaque ligne de chaque `.ld` du corpus
porte ses scopes attendus). Il est volontairement absent de
`npm test` : ce patch est purement additif (aucun fichier existant
modifié), l'entrée se câble à l'intégration.

## L'analyse statique, ensuite

La coloration est déclarative ; les diagnostics (checks, verdicts,
`tests/expect` rejoués) demandent un serveur de langue qui importe
le noyau TypeScript (`src/domain`) : voir la discussion du patch.
