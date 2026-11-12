// ---- le feu de Moore — moore-traffic-light : le plus petit modèle
//      honnête de la famille : trois états (rouge / vert / ambre),
//      chacun porte sa sortie, trois transitions en cycle (le check
//      simple du tronc exige des arêtes distinctes — le feu est un
//      graphe simple, une transition de plus serait parallèle).
//      Idiome multihypergraph : l'incidence est portée, la paire
//      exige deux flèches (min = max = 2). Refines explicites :
//      l'espace principal ne joue pas le désucrage.
layer moore-traffic-light refines @moore-machine
  extend states
    red refines @moore-traffic-light/specification/state_type
      identifier = "red"
      output = "stop"
    green refines @moore-traffic-light/specification/state_type
      identifier = "green"
      output = "go"
    amber refines @moore-traffic-light/specification/state_type
      identifier = "amber"
      output = "prepare"
  extend transitions
    to_green refines @moore-traffic-light/specification/transition_type
      identifier = "to_green"
      extend arrows
        tg1 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/red
        tg2 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/green
    to_amber refines @moore-traffic-light/specification/transition_type
      identifier = "to_amber"
      extend arrows
        ta1 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/green
        ta2 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/amber
    to_red refines @moore-traffic-light/specification/transition_type
      identifier = "to_red"
      extend arrows
        tr1 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/amber
        tr2 refines @multihypergraph/specification/edge_type/arrow_type
          vertex = @moore-traffic-light/states/red
  tests
    expect states/red/output = "stop"
    expect states/green/identifier = "green"
    expect transitions/to_amber/identifier = "to_amber"
    expect transitions/to_green/arrows/tg1/vertex = @moore-traffic-light/states/red
    expect transitions/to_red/arrows/tr1/vertex = @moore-traffic-light/states/amber
    expect states/amber/acceptance absent
