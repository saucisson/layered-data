// ---- la base des positions — positions-scheme. Des objets nommés
//      reçoivent des coordonnées dans un système : la grille
//      (positions-grid, axes cartésiens) ou le pôle (positions-polar,
//      distance et angle). Les axes sont des slots abstraits posés
//      au schéma : la dimension est une donnée — 1D : x seul ; 2D :
//      x et y ; 3D : x, y, z (le pôle ajoute z au plan : le cylindre ;
//      la sphère n'est pas posée). Une position peut être relative :
//      relative_to cite une position amont et porte un décalage —
//      la grille ajoute composante par composante, le pôle dit
//      distance et direction depuis le point cité ; la chaîne se
//      résout au premier point absolu et le repère ne tourne pas
//      (la rotation resterait un axe à nommer). La donnée reste
//      brute : la résolution vit au lecteur (posOf).
layer positions-scheme refines @record
  extend specification
    position_type refines @record
      extend specification
        extend record
          abstract system
          abstract relative_to
          abstract x
          abstract y
          abstract z
          abstract r
          abstract theta
  positions refines @collection
    extend specification
      extend collection
        override type = @positions-scheme/specification/position_type
