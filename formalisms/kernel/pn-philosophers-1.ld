// ---- the template — pn-philosophers-1: ONE philosopher of the dinner —
//      think1/eat1/fork1, take1/release1, pt1/er1/te1 — the NETWORK
//      PIECE that the pn-philosophers-5 layer below instantiates
//      five times; arcs carry a weight (arc weight, usual Petri net
//      terminology, aligned with weighted-hypergraph's weight,
//      default 1).
layer pn-philosophers-1 refines @pn-philosophers then @positions-grid
  extend places
    think1 refines @pn-philosophers/specification/think
      identifier = 1
      override marking = 1
    eat1 refines @pn-philosophers/specification/eat
      identifier = 1
      override marking = 0
    fork1 refines @pn-philosophers/specification/fork
      identifier = 1
      override marking = 1
  extend transitions
    take1 refines @pn-philosophers/specification/take
      identifier = 1
    release1 refines @pn-philosophers/specification/release
      identifier = 1
  // pre arcs (place → transition) and post arcs (transition → place); the
  // arcs alias reunites them. Explicit refines: the main space does not play
  // desugaring (which would make them implicit)
  extend pre_arcs
    pt1 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-1/places/think1
      target = @pn-philosophers-1/transitions/take1
    er1 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-1/places/eat1
      target = @pn-philosophers-1/transitions/release1
  extend post_arcs
    te1 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-1/transitions/take1
      target = @pn-philosophers-1/places/eat1
  // positions locales du philosophe : le
  // seat is the origin of the local frame — think1, fork1, eat1 in
  // the column to its left, take1, release1 to its right; each
  // position CITES the seat (relative_to) and carries its offset —
  // the dinner will re-pose only the five seats, everything else
  // descendra du template par la citation
  extend positions
    seat refines @positions-grid/specification/position_type
      x = 0
      y = 0
    think1 refines @positions-grid/specification/position_type
      relative_to = @pn-philosophers-1/positions/seat
      x = -70
      y = -60
    fork1 refines @positions-grid/specification/position_type
      relative_to = @pn-philosophers-1/positions/seat
      x = -70
      y = 0
    eat1 refines @positions-grid/specification/position_type
      relative_to = @pn-philosophers-1/positions/seat
      x = -70
      y = 60
    take1 refines @positions-grid/specification/position_type
      relative_to = @pn-philosophers-1/positions/seat
      x = 80
      y = -60
    release1 refines @positions-grid/specification/position_type
      relative_to = @pn-philosophers-1/positions/seat
      x = 80
      y = 60
