// ---- le dîner symétrique — swn-philosophers-5 : le dîner en SWN. Une
//      seule donnée de structure : la classe ph (cinq philosophes,
//      ORDONNÉE — la fourchette du voisin s'écrit ⟨x⊕1⟩ par le
//      successeur de l'axe ordonné posé par symmetric-petrinet). Trois
//      places (think, eat, forks, toutes de domaine ph), deux
//      transitions (take, release), huit arcs — les inscriptions font
//      le travail des vingt-cinq arcs du dîner P/T : le modèle
//      symétrique est LE modèle du treillis, le P/T en est le déploiement.
//      Le marquage initial est UNIFORME : S(ph) sur think et forks,
//      rien sur eat — la symétrie initiale est posée par la donnée, le
//      quotient l'exige. Le croisement stochastique enchaîne (modèle
//      d'abord, axe ensuite) : le même taux partout — un philosophe
//      glouton briserait la symétrie, ce rôle reste au dîner P/T
//      (spn-philosophers-5 garde son rate 1.5).
layer swn-philosophers-5 refines @symmetric-petrinet then @stochastic-well-formed
  extend color_classes
    ph refines @colored-petrinet/specification/color_type
      cardinality = 5
      ordered = true
  extend places
    think refines @colored-petrinet/specification/place_type
      color_domain = @swn-philosophers-5/color_classes/ph
      marking = "S(ph)"
      initial_symmetry = "uniform"
    eat refines @colored-petrinet/specification/place_type
      color_domain = @swn-philosophers-5/color_classes/ph
      initial_symmetry = "uniform"
    forks refines @colored-petrinet/specification/place_type
      color_domain = @swn-philosophers-5/color_classes/ph
      marking = "S(ph)"
      initial_symmetry = "uniform"
  extend transitions
    take refines @colored-petrinet/specification/transition_type
      variables = "x:ph"
      rate = 1.0
    release refines @colored-petrinet/specification/transition_type
      variables = "x:ph"
      rate = 1.0
  // la garde absente est la garde vraie — une transition sans garde
  // tire sur toute liaison de ses variables
  extend pre_arcs
    take_think refines @petrinet-scheme/specification/pre_arc_type
      source = @swn-philosophers-5/places/think
      target = @swn-philosophers-5/transitions/take
      inscription = "<x>"
    take_fork_own refines @petrinet-scheme/specification/pre_arc_type
      source = @swn-philosophers-5/places/forks
      target = @swn-philosophers-5/transitions/take
      inscription = "<x>"
    take_fork_next refines @petrinet-scheme/specification/pre_arc_type
      source = @swn-philosophers-5/places/forks
      target = @swn-philosophers-5/transitions/take
      inscription = "<x⊕1>"
    release_eat refines @petrinet-scheme/specification/pre_arc_type
      source = @swn-philosophers-5/places/eat
      target = @swn-philosophers-5/transitions/release
      inscription = "<x>"
  extend post_arcs
    take_eat refines @petrinet-scheme/specification/post_arc_type
      source = @swn-philosophers-5/transitions/take
      target = @swn-philosophers-5/places/eat
      inscription = "<x>"
    release_think refines @petrinet-scheme/specification/post_arc_type
      source = @swn-philosophers-5/transitions/release
      target = @swn-philosophers-5/places/think
      inscription = "<x>"
    release_fork_own refines @petrinet-scheme/specification/post_arc_type
      source = @swn-philosophers-5/transitions/release
      target = @swn-philosophers-5/places/forks
      inscription = "<x>"
    release_fork_next refines @petrinet-scheme/specification/post_arc_type
      source = @swn-philosophers-5/transitions/release
      target = @swn-philosophers-5/places/forks
      inscription = "<x⊕1>"
  // le contrat du dîner symétrique — la scène porte ses attendus, la
  // validation les rejoue
  tests
    expect color_classes/ph/cardinality = 5
    expect color_classes/ph/ordered = true
    expect places/think/color_domain = @swn-philosophers-5/color_classes/ph
    expect places/forks/marking = "S(ph)"
    expect places/eat/marking absent
    expect pre_arcs/take_fork_next/inscription = "<x⊕1>"
    expect transitions/take/rate = 1.0
    expect transitions/take/firing_weight = 1.0
