// ---- axe arcs inhibiteurs — inhibitor-petrinet : l'arc inhibiteur
//      teste le vide de sa place source (zero-test : il lit sans
//      consommer). Même idiome que la partition de petrinet-scheme :
//      un type d'arc à conteneurs croisés, une collection dédiée,
//      l'alias arcs s'étend — le poids hérité de l'arc Petri devient
//      le seuil du test (0 : la place est vide).
layer inhibitor-petrinet refines @petrinet-scheme
  extend specification
    inhibitor_arc_type refines @petrinet-scheme/specification/arc_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @inhibitor-petrinet/places
          extend target
            override container = @inhibitor-petrinet/transitions
  inhibitor_arcs refines @collection
    extend specification
      extend collection
        override type = @inhibitor-petrinet/specification/inhibitor_arc_type
  // l'alias s'étend : les arcs, c'est les pré, les post ET les inhibiteurs
  extend arcs refines @petrinet-scheme/arcs then @inhibitor-petrinet/inhibitor_arcs
  extend edges refines @inhibitor-petrinet/arcs
