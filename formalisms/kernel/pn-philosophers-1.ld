// ---- le template — pn-philosophers-1 : UN philosophe du dîner —
//      think1/eat1/fork1, take1/release1, pt1/er1/te1 — le MORCEAU
//      de réseau que la couche pn-philosophers-5 ci-dessous
//      instancie cinq fois ; les arcs portent un weight (poids
//      d'arc, terminologie usuelle des réseaux de Petri, alignée
//      sur le weight de weighted-hypergraph, défaut 1).
layer pn-philosophers-1 refines @pn-philosophers then @positions-grid
  extend places
    think1 refines @pn-philosophers/specification/think
      identifier = 1
      marking = 1
    eat1 refines @pn-philosophers/specification/eat
      identifier = 1
      marking = 0
    fork1 refines @pn-philosophers/specification/fork
      identifier = 1
      marking = 1
  extend transitions
    take1 refines @pn-philosophers/specification/take
      identifier = 1
    release1 refines @pn-philosophers/specification/release
      identifier = 1
  // arcs pré (place → transition) et post (transition → place) ; l'alias
  // arcs les réunit. Refines explicites : l'espace principal ne joue pas le
  // désucrage (qui les rendrait implicites)
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
  // siège est l'origine du repère local — think1, fork1, eat1 en
  // colonne à sa gauche, take1, release1 à sa droite ; chaque
  // position CITE le siège (relative_to) et porte son décalage —
  // le dîner ne reposera que les cinq sièges, tout le reste
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
