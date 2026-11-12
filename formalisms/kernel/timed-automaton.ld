// ---- axe temps — timed-automaton (Alur-Dill) : des horloges
//      réinitialisées par les transitions, des gardes sur les
//      transitions, des invariants sur les états. L'état du réseau
//      est la paire (location, valuation d'horloges) ; l'espace
//      quotient est le graphe de zones — zone-statespace côté Petri
//      en montre le même idiome. Les horloges sont des données de
//      l'instance (une collection de noms), pas du schéma.
layer timed-automaton refines @automaton-scheme
  extend specification
    extend state_type
      extend specification
        extend record
          abstract invariant
    extend transition_type
      extend specification
        extend record
          abstract guard
          abstract resets
