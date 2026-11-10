// ---- oriented-graph — the mathematician's strict sense: an oriented
//      graph without opposite arc pairs. Not to be confused with
//      multidigraph, which carries the base's multiplicity: strict
//      orientation is here. Check per arc address.
//      NOTE (ADR-0105 strate 2): the instance level is not yet judged
//      by the declarative strate; the check stays algorithmic until
//      then.
layer oriented-graph refines @digraph
  extend edge_type
    check oriented
