// ---- le template du tutoriel : UN philosophe. La couche raffine le
//      réseau de Petri et instancie un philosophe seul — trois
//      places (think, eat, fork), deux transitions (take, release),
//      trois arcs. Le vocabulaire est typé (specification/think…),
//      les membres raffinent leurs types et posent identifier et
//      marking. La contrainte posée au niveau de la déclaration :
//      arc_type weight = 1 — tout arc qui raffine le type en
//      hérite, aucun modèle ne le réécrit.
layer philosophers refines @petrinet
  extend specification
    think refines @philosophers/specification/place_type
    eat refines @philosophers/specification/place_type
    fork refines @philosophers/specification/place_type
    take refines @philosophers/specification/transition_type
    release refines @philosophers/specification/transition_type
    extend arc_type
      weight = 1
      extend specification
        extend record
          override abstract weight
  extend places
    think refines @philosophers/specification/think
      identifier = 1
      marking = 1
    eat refines @philosophers/specification/eat
      identifier = 1
      marking = 0
    fork refines @philosophers/specification/fork
      identifier = 1
      marking = 1
  extend transitions
    take refines @philosophers/specification/take
      identifier = 1
    release refines @philosophers/specification/release
      identifier = 1
  extend arcs
    pt refines @petrinet/specification/arc_type
      source = @philosophers/places/think
      target = @philosophers/transitions/take
    te refines @petrinet/specification/arc_type
      source = @philosophers/transitions/take
      target = @philosophers/places/eat
    er refines @petrinet/specification/arc_type
      source = @philosophers/places/eat
      target = @philosophers/transitions/release
