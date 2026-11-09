// ---- the dinner — pn-philosophers-5: FIVE philosophers, five
//      CITATIONS of the pn-philosophers-1 template. The philosophers
//      collection (joined to collection) carries one citation per
//      philosopher — lref of the template, identifier posed; the FOUR
//      containers each carry a UNION EQUATION TO THE PARENT:
//      their refines cites the five windows (philosophers, philoN,
//      container) — the engine's reader (expandCitations) expands
//      each citation: the template's members land QUALIFIED
//      (philoN.think1…), each generated member refines the cited
//      member BY ITS PATH (the datum stays in the template; marking,
//      identifier and types descend through the closure) and the cited
//      member's internal Refs land
//      anchored on the dinner, designated key qualified. Ring
//      connections authorized: fork_i is taken by the take of
//      philosopher i+1 (pre arc fk_i) and released by its release (post
//      arc rf_i), modulo 5 — the dinner is fully wired:
//      15 places, 10 transitions, 25 arcs, weight 1 partout.
layer pn-philosophers-5 refines @pn-philosophers then @positions-grid
  philosophes refines @collection
    philo1 refines @pn-philosophers-1
      identifier = 1
    philo2 refines @pn-philosophers-1
      identifier = 2
    philo3 refines @pn-philosophers-1
      identifier = 3
    philo4 refines @pn-philosophers-1
      identifier = 4
    philo5 refines @pn-philosophers-1
      identifier = 5
  extend places refines @pn-philosophers-5/philosophes/philo1/places then @pn-philosophers-5/philosophes/philo2/places then @pn-philosophers-5/philosophes/philo3/places then @pn-philosophers-5/philosophes/philo4/places then @pn-philosophers-5/philosophes/philo5/places
  extend transitions refines @pn-philosophers-5/philosophes/philo1/transitions then @pn-philosophers-5/philosophes/philo2/transitions then @pn-philosophers-5/philosophes/philo3/transitions then @pn-philosophers-5/philosophes/philo4/transitions then @pn-philosophers-5/philosophes/philo5/transitions
  extend pre_arcs refines @pn-philosophers-5/philosophes/philo1/pre_arcs then @pn-philosophers-5/philosophes/philo2/pre_arcs then @pn-philosophers-5/philosophes/philo3/pre_arcs then @pn-philosophers-5/philosophes/philo4/pre_arcs then @pn-philosophers-5/philosophes/philo5/pre_arcs
    fk1 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-5/places/philo1.fork1
      target = @pn-philosophers-5/transitions/philo2.take1
    fk2 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-5/places/philo2.fork1
      target = @pn-philosophers-5/transitions/philo3.take1
    fk3 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-5/places/philo3.fork1
      target = @pn-philosophers-5/transitions/philo4.take1
    fk4 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-5/places/philo4.fork1
      target = @pn-philosophers-5/transitions/philo5.take1
    fk5 refines @petrinet-scheme/specification/pre_arc_type
      source = @pn-philosophers-5/places/philo5.fork1
      target = @pn-philosophers-5/transitions/philo1.take1
  extend post_arcs refines @pn-philosophers-5/philosophes/philo1/post_arcs then @pn-philosophers-5/philosophes/philo2/post_arcs then @pn-philosophers-5/philosophes/philo3/post_arcs then @pn-philosophers-5/philosophes/philo4/post_arcs then @pn-philosophers-5/philosophes/philo5/post_arcs
    rf1 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-5/transitions/philo2.release1
      target = @pn-philosophers-5/places/philo1.fork1
    rf2 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-5/transitions/philo3.release1
      target = @pn-philosophers-5/places/philo2.fork1
    rf3 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-5/transitions/philo4.release1
      target = @pn-philosophers-5/places/philo3.fork1
    rf4 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-5/transitions/philo5.release1
      target = @pn-philosophers-5/places/philo4.fork1
    rf5 refines @petrinet-scheme/specification/post_arc_type
      source = @pn-philosophers-5/transitions/philo1.release1
      target = @pn-philosophers-5/places/philo5.fork1
  // the dinner's positions: one equation
  // d'union comme les quatre autres conteneurs — les cinq
  // template windows expand their local positions there
  // qualified (philoN.think1… cites seat philoN, re-anchored
  // by the citation); the dinner poses only the table and the
  // five seats: the table at the center, each seat cites it in
  // polaire — distance 190, angle k·72° — et tout le reste
  // descend du template
  extend positions refines @pn-philosophers-5/philosophes/philo1/positions then @pn-philosophers-5/philosophes/philo2/positions then @pn-philosophers-5/philosophes/philo3/positions then @pn-philosophers-5/philosophes/philo4/positions then @pn-philosophers-5/philosophes/philo5/positions
    table refines @positions-grid/specification/position_type
      x = 0
      y = 0
    philo1.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-5/positions/table
      r = 190
      theta = 0
    philo2.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-5/positions/table
      r = 190
      theta = 72
    philo3.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-5/positions/table
      r = 190
      theta = 144
    philo4.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-5/positions/table
      r = 190
      theta = 216
    philo5.seat refines @positions-grid/specification/position_type
      abstract x
      abstract y
      system = "polar"
      relative_to = @pn-philosophers-5/positions/table
      r = 190
      theta = 288
  // the dinner's contract — the scene carries its expectations, the
  // validation les rejoue. Un
  tests
    expect places/philo1.think1/marking = 1
    expect places/philo1.eat1/marking = 0
    expect philosophes/philo3/identifier = 3
    expect pre_arcs/fk2/weight = 1
    expect positions/philo1.seat/system = "polar"
    expect positions/philo1.seat/x absent
    expect pre_arcs/fk5/source = @pn-philosophers-5/places/philo5.fork1
