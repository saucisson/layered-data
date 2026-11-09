// ---- digraph — pure arcs: orientation (multidigraph) crossed
//      with purity (hypergraph). No parallel arcs, no arc loops,
//      legal 2-cycles (the theory's "simple digraph"). The simple
//      check, inherited from hypergraph, fires on the ordered pair
//      (multidigraph in the chain). Pure diamond.
layer digraph refines @multidigraph then @hypergraph
