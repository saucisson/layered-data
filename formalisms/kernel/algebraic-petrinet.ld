// ---- axe algèbre — algebraic-petrinet : inscriptions et marquages
//      vivent dans une algèbre de multi-ensembles (semianneau
//      commutatif : addition = union pondérée, produit = produit
//      cartésien, zéro = marquage vide). L'algèbre est un membre
//      typé du schéma, pas une hypothèse du moteur : carrier, plus,
//      times, zero sont des slots — le raffinement les fournit, la
//      lecture suit. Le poids entier du P/T est le cas dégénéré
//      (algèbre triviale sur N).
layer algebraic-petrinet refines @colored-petrinet
  marking_algebra refines @record
    extend specification
      extend record
        abstract carrier
        abstract plus
        abstract times
        abstract zero
  // le lien est une désignation tardive : chaque place lisante lit
  // son marquage comme élément de l'algèbre posée dans sa couche
  extend specification
    extend place_type
      extend specification
        extend record
          abstract marking_term
