// ---- petrinet-scheme : trois parents — la partition
//      (bipartite-digraph), l'annotation des sommets et celle des
//      arêtes (marking et weight en sont les instances nommées par
//      la famille). Le schéma réutilise les types des axes et
//      redéfinit ses conteneurs — les noms ne se raffinent pas
//      (places ≠ left), les chemins si.
layer petrinet-scheme refines @bipartite-digraph then @vertex-annotated-hypergraph then @edge-annotated-hypergraph
  extend specification
    place_type refines @petrinet-scheme/specification/vertex_type
      extend specification
        extend record
          abstract marking
          override abstract identifier
    transition_type refines @petrinet-scheme/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
    // même chemin que la racine multidigraph::edge_type : l'arc
    // du Petri raffine l'arête orientée, et y ajoute le poids
    arc_type refines @petrinet-scheme/edge_type
      extend specification
        extend record
          abstract weight
          override abstract identifier
          extend source
            override container = @petrinet-scheme/vertices
          extend target
            override container = @petrinet-scheme/vertices
    // héritage multiple au niveau type : deux parents — l'arc
    // Petri (poids) et l'arc croisé A→B de l'axe partition.
    // Ordre = spécificité : le type Petri d'abord, l'axe ensuite.
    pre_arc_type refines @petrinet-scheme/specification/arc_type then @bipartite-digraph/specification/arcAB_type
      extend specification
        extend record
          extend source
            override container = @petrinet-scheme/places
          extend target
            override container = @petrinet-scheme/transitions
    post_arc_type refines @petrinet-scheme/specification/arc_type then @bipartite-digraph/specification/arcBA_type
      extend specification
        extend record
          extend source
            override container = @petrinet-scheme/transitions
          extend target
            override container = @petrinet-scheme/places
  places refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/place_type
  transitions refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/transition_type
  pre_arcs refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/pre_arc_type
  post_arcs refines @collection
    extend specification
      extend collection
        override type = @petrinet-scheme/specification/post_arc_type
  // alias : les arcs, c'est les pre plus les post
  extend arcs refines @petrinet-scheme/pre_arcs then @petrinet-scheme/post_arcs
  extend vertices refines @petrinet-scheme/places then @petrinet-scheme/transitions
  extend edges refines @petrinet-scheme/arcs
