// ---- l'espace d'états — un automate paramétré par le réseau : le
//      slot petrinet (typé petrinet-scheme), le behavior (le même
//      paramètre), et state_type qui raffine le type d'état du
//      behavior. La dépendance n'est pas en prose : l'espace et le
//      réseau partagent des adresses.
layer petrinet-statespace refines @automaton-scheme
  petrinet refines @petrinet-scheme
  behavior refines @petrinet-behavior
    petrinet = @petrinet-statespace/petrinet
  extend specification
    extend state_type refines @petrinet-statespace/behavior/specification/state_type
  extend alphabet
    extend specification
      extend collection
        override type = @petrinet-statespace/behavior/specification/binding_type
