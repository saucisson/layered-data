// ---- bound variant — pn-philosophers-5-bounds-c1: bound 1
//      posed on philo1.think1, through the dinner — the closure
//      crosses the template's five citations (15 places, 10
//      transitions); the qualified member is the one the citation
//      generated.
layer pn-philosophers-5-bounds-c1 refines @pn-philosophers-5-bounds
  extend places
    extend philo1.think1 refines @pn-philosophers/specification/think
      bound = 1
