// ---- axe arcs de remise à zéro — reset-petrinet : l'arc de reset
//      vide sa place source au tir, sans poids ni multiplicité.
//      Le poids reste abstrait (hérité de petrinet-scheme) : aucun
//      défaut ne transpire, la lecture s'arrête là.
layer reset-petrinet refines @petrinet-scheme
  extend specification
    reset_arc_type refines @petrinet-scheme/specification/arc_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @reset-petrinet/places
          extend target
            override container = @reset-petrinet/transitions
  reset_arcs refines @collection
    extend specification
      extend collection
        override type = @reset-petrinet/specification/reset_arc_type
  extend arcs refines @petrinet-scheme/arcs then @reset-petrinet/reset_arcs
  extend edges refines @reset-petrinet/arcs
