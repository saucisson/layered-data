// ---- axe partition, cas k = 2 — bipartite-digraph : la
//      spécialisation du k-partite pour deux classes, croisée avec
//      l'orientation. Raffine multidigraph et k-partite-hypergraph —
//      le « bipartite graph » des math est non orienté et simple ;
//      le nôtre porte des arcs (le check k-partite hérité tire sur
//      chaque descendant). L'idiome est celui de la partition :
//      left / right, arcs croisés A→B et B→A ; petrinet-scheme et
//      kahn-scheme le raffinent.
layer bipartite-digraph refines @multidigraph then @k-partite-hypergraph
  extend specification
    left_type refines @bipartite-digraph/specification/vertex_type
    right_type refines @bipartite-digraph/specification/vertex_type
    // arcs croisés : A→B et B→A, conteneurs imposés par le record
    arcAB_type refines @bipartite-digraph/edge_type
      extend specification
        extend record
          extend source
            override container = @bipartite-digraph/left
          extend target
            override container = @bipartite-digraph/right
    arcBA_type refines @bipartite-digraph/edge_type
      extend specification
        extend record
          extend source
            override container = @bipartite-digraph/right
          extend target
            override container = @bipartite-digraph/left
  left refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/left_type
  right refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/right_type
  arcsAB refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/arcAB_type
  arcsBA refines @collection
    extend specification
      extend collection
        override type = @bipartite-digraph/specification/arcBA_type
  // alias, même idiome que petrinet-scheme
  arcs refines @bipartite-digraph/arcsAB then @bipartite-digraph/arcsBA
  extend vertices refines @bipartite-digraph/left then @bipartite-digraph/right
  extend edges refines @bipartite-digraph/arcs
