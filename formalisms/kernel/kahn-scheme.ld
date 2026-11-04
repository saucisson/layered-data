// famille Kahn : raffine bipartite-digraph, et les types d'arcs
// ont deux parents (l'arête à la racine de kahn + l'arc croisé de
// l'axe partition)
layer kahn-scheme refines @bipartite-digraph
  extend specification
    process_type refines @kahn-scheme/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
    channel_type refines @kahn-scheme/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract capacity
    // deux parents : l'arête à la racine de kahn-scheme (résolue
    // vers multidigraph::edge_type orienté) et l'arc croisé de
    // bipartite-digraph
    write_type refines @kahn-scheme/edge_type then @bipartite-digraph/specification/arcAB_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @kahn-scheme/processes
          extend target
            override container = @kahn-scheme/channels
    read_type refines @kahn-scheme/edge_type then @bipartite-digraph/specification/arcBA_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @kahn-scheme/channels
          extend target
            override container = @kahn-scheme/processes
  processes refines @collection
    extend specification
      extend collection
        override type = @kahn-scheme/specification/process_type
  channels refines @collection
    extend specification
      extend collection
        override type = @kahn-scheme/specification/channel_type
  writes refines @collection
    extend specification
      extend collection
        override type = @kahn-scheme/specification/write_type
  reads refines @collection
    extend specification
      extend collection
        override type = @kahn-scheme/specification/read_type
  extend vertices refines @kahn-scheme/processes then @kahn-scheme/channels
  extend edges refines @kahn-scheme/writes then @kahn-scheme/reads
