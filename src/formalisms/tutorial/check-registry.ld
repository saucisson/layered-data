// ---- le registre des checks du tutoriel, réduit aux deux étiquettes
//      génériques que le corpus pose : containers et cardinality.
//      Le contrat est une donnée (ADR-0019) — l'étiquette déclare où
//      elle juge (level : la racine de la couche), le noyau porte
//      l'algorithme. L'audit croisé contrat↔algorithme (le lint du
//      noyau) ne se joue que sur le corpus noyau : ce registre
//      ci-dessus ne porte que le sous-ensemble du tutoriel.
layer check-registry
  specification
    containers
      level = "root"
    cardinality
      level = "root"
