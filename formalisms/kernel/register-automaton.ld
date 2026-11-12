// ---- axe données — register-automaton : l'automate à registres
//      (langages de données : l'égalité et l'ordre, pas les
//      valeurs). Les registres vivent dans une collection typée
//      (chaque registre porte son domaine) ; chaque transition
//      porte une garde (comparaison aux registres) et une
//      affectation (le registre qui capte la donnée lue).
layer register-automaton refines @automaton-scheme
  registers refines @collection
    extend specification
      extend collection
        override type = @register-automaton/specification/register_type
  extend specification
    register_type refines @record
      extend specification
        extend record
          abstract domain
    extend transition_type
      extend specification
        extend record
          abstract guard
          abstract assignment
