// ---- mixed-graph — (V, E, A) : arêtes non orientées et arcs
//      orientés dans le même formalisme. Mécanisme : les arêtes de
//      paire de pair-graph restent disponibles telles quelles (2
//      flèches sans rôles), et l'arc orienté est un arc_type qui
//      raffine l'arête de paire en y greffant les rôles source/target
//      (l'idiome d'auto-désignation du multidigraphe) — le modèle
//      range ses paires dans edges (la base) et ses arcs dans arcs
//      (la collection typée ci-dessous). Aucun modèle du tronc ne
//      raffine mixed-graph : mécanisme posé, exercé par la seule
//      marche de la couche.
layer mixed-graph refines @named-ends-hypergraph then @pair-graph
  extend specification
    arc_type refines @mixed-graph/edge_type
      extend specification
        extend record
          source
            container = @mixed-graph/vertices
          target
            container = @mixed-graph/vertices
      extend arrows
        source
          vertex = @arc_type/source
        target
          vertex = @arc_type/target
  arcs refines @collection
    extend specification
      extend collection
        override type = @mixed-graph/specification/arc_type
