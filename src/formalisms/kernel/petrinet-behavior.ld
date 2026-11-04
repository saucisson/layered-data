// ---- le comportement — paramétré par le réseau. Le type d'un
//      état raffine le paramètre « petrinet » : un chemin qui
//      n'existe pas ici — résolu par liaison tardive dans la couche
//      lisante (ss-pn-philosophers-5 pose petrinet = pn-philosophers-5 :
//      le type d'un état de ss-pn-philosophers-5 est
//      pn-philosophers-5). Le type d'une liaison (binding_type)
//      pointe les transitions du réseau — forward ref assumé : le
//      slot petrinet vit chez petrinet-statespace, fourni plus bas.
layer petrinet-behavior refines @record
  extend specification
    state_type refines @petrinet-behavior/petrinet
    binding_type refines @record
      extend specification
        extend record
          transition
            container = @petrinet-statespace/petrinet/transitions
