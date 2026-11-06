// ---- l'espace d'états du tutoriel : un automate PARAMÉTRÉ par le
//      réseau. Le slot net raffine la couche petrinet entière —
//      personne ne le pose ici. Le type d'un état raffine le slot :
//      l'état descend du réseau, chaque marquage du réseau se lit
//      dans l'état. Le type d'une liaison (binding_type) pointe les
//      transitions du réseau à travers le slot — résolu par la
//      couche lisante, jamais ici.
layer state-space refines @automaton
  net refines @petrinet
  extend specification
    extend state_type refines @state-space/net
    binding_type refines @record
      extend specification
        extend record
          transition
            container = @state-space/net/transitions
  extend alphabet
    extend specification
      extend collection
        override type = @state-space/specification/binding_type
