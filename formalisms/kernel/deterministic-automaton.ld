// ---- axe déterminisme — deterministic-automaton : au plus une
//      course par mot — un état initial (l'axe départ), au plus une
//      transition par (état source, lettre) (l'axe lecture). La
//      contrainte est portée par les données, pas par un check : le
//      modèle qui la viole n'est pas ce modèle (le contrat du type,
//      idiome de safe-petrinet). La complétude (au moins une course
//      par lettre) est une autre question — l'automate partiel est
//      licite, l'instance tranche. L'ordre déclare la spécificité :
//      le départ d'abord, la lettre ensuite.
layer deterministic-automaton refines @initial-automaton then @letter-automaton
