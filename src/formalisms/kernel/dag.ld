// ---- dag — acyclicity. No model of the trunk refines this layer: the
//      label does not fire beyond its declaration.
//      NOTE (ADR-0022 strate 2): acyclicity needs transitive closure
//      (`reachable`), not yet in the first-order fragment. The check
//      stays algorithmic until strate 2 lands.
layer dag refines @multidigraph
  extend edge_type
    check dag
