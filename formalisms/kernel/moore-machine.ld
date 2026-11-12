// ---- axe sortie d'état — moore-machine : la sortie est portée par
//      l'état (idiome d'annotation des sommets : le vertex_type du
//      tronc déjà annoté en marking par petrinet-scheme — ici la
//      sortie du moment). Idiome de pn-philosophers-5-bounds : le
//      slot est posé dans le record du type d'état, la fermeture
//      descend jusqu'aux instances.
layer moore-machine refines @automaton-scheme
  extend specification
    extend state_type
      extend specification
        extend record
          abstract output
