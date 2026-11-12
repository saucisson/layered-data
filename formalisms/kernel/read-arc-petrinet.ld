// ---- axe arcs de lecture — read-arc-petrinet : l'arc de lecture
//      (test) exige sa multiplicité sans rien consommer ni produire
//      — la ressource est lue, pas prise. Même idiome que
//      l'inhibiteur : type croisé, collection dédiée, alias étendu.
//      Le poids hérité devient la multiplicité testée.
layer read-arc-petrinet refines @petrinet-scheme
  extend specification
    read_arc_type refines @petrinet-scheme/specification/arc_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @read-arc-petrinet/places
          extend target
            override container = @read-arc-petrinet/transitions
  read_arcs refines @collection
    extend specification
      extend collection
        override type = @read-arc-petrinet/specification/read_arc_type
  extend arcs refines @petrinet-scheme/arcs then @read-arc-petrinet/read_arcs
  extend edges refines @read-arc-petrinet/arcs
