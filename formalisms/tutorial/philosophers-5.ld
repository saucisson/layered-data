// ---- the tutorial's model: FIVE philosophers, five CITATIONS of the
//      template. La collection philosophes porte une citation par
//      philosopher (lref of the template, identifier posed); the reader
//      expands each citation: the template's members
//      land qualified (philo2.think…), the internal refs
//      anchor on the dinner. The three containers each carry
//      a union equation to the parent (then), the ring closes
//      on the shared forks: fk_i leaves the fork and returns
//      du philosophe i vers le take du philosophe i+1, rf_i la lui
//      — modulo 5. The cardinality of the philosophers collection
//      is declared here (5, measured): the cardinality check carried by
//      graph replays the contract. Measured total: 15 places, 10 transitions,
//      25 arcs, weight 1 partout.
layer philosophers-5 refines @philosophers
  philosophes refines @collection
    extend specification
      extend collection
        override minimum = 5
        override maximum = 5
    philo1 refines @philosophers
      identifier = 1
    philo2 refines @philosophers
      identifier = 2
    philo3 refines @philosophers
      identifier = 3
    philo4 refines @philosophers
      identifier = 4
    philo5 refines @philosophers
      identifier = 5
  extend places refines @philosophers-5/philosophes/philo1/places then @philosophers-5/philosophes/philo2/places then @philosophers-5/philosophes/philo3/places then @philosophers-5/philosophes/philo4/places then @philosophers-5/philosophes/philo5/places
  extend transitions refines @philosophers-5/philosophes/philo1/transitions then @philosophers-5/philosophes/philo2/transitions then @philosophers-5/philosophes/philo3/transitions then @philosophers-5/philosophes/philo4/transitions then @philosophers-5/philosophes/philo5/transitions
  extend arcs refines @philosophers-5/philosophes/philo1/arcs then @philosophers-5/philosophes/philo2/arcs then @philosophers-5/philosophes/philo3/arcs then @philosophers-5/philosophes/philo4/arcs then @philosophers-5/philosophes/philo5/arcs
    fk1 refines @petrinet/specification/arc_type
      source = @philosophers-5/places/philo1.fork
      target = @philosophers-5/transitions/philo2.take
    fk2 refines @petrinet/specification/arc_type
      source = @philosophers-5/places/philo2.fork
      target = @philosophers-5/transitions/philo3.take
    fk3 refines @petrinet/specification/arc_type
      source = @philosophers-5/places/philo3.fork
      target = @philosophers-5/transitions/philo4.take
    fk4 refines @petrinet/specification/arc_type
      source = @philosophers-5/places/philo4.fork
      target = @philosophers-5/transitions/philo5.take
    fk5 refines @petrinet/specification/arc_type
      source = @philosophers-5/places/philo5.fork
      target = @philosophers-5/transitions/philo1.take
    rf1 refines @petrinet/specification/arc_type
      source = @philosophers-5/transitions/philo2.release
      target = @philosophers-5/places/philo1.fork
    rf2 refines @petrinet/specification/arc_type
      source = @philosophers-5/transitions/philo3.release
      target = @philosophers-5/places/philo2.fork
    rf3 refines @petrinet/specification/arc_type
      source = @philosophers-5/transitions/philo4.release
      target = @philosophers-5/places/philo3.fork
    rf4 refines @petrinet/specification/arc_type
      source = @philosophers-5/transitions/philo5.release
      target = @philosophers-5/places/philo4.fork
    rf5 refines @petrinet/specification/arc_type
      source = @philosophers-5/transitions/philo1.release
      target = @philosophers-5/places/philo5.fork
  tests
    expect places/philo1.think/marking = 1
    expect places/philo2.fork/marking = 1
    expect philosophes/philo3/identifier = 3
    expect arcs/fk2/weight = 1
    expect arcs/fk5/source = @philosophers-5/places/philo5.fork
