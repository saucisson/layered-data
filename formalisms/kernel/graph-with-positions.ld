// ---- derivation — graph-with-positions: a graph whose vertices
//      are positioned — the composition of graph and grid; the keys
//      of the positions collection name the vertices, the lens
//      resolves and draws them (circle fold without positions), the
//      relative one derives a graph from another without re-posing
//      its points
layer graph-with-positions refines @graph then @positions-grid
