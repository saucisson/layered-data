// ---- composition discret × continu — hybrid-petrinet : des places
//      discrètes ET des places fluides, des transitions instantanées
//      ET des transitions à flot. Le schéma hybride hérite des deux
//      familles (ordre = spécificité : le discret du tronc d'abord,
//      l'axe fluide ensuite) et ajoute le vocabulaire de partage :
//      chaque place porte sa phase (discrete ou continuous), chaque
//      transition sa nature.
layer hybrid-petrinet refines @petrinet-scheme then @continuous-petrinet
  extend specification
    extend place_type
      extend specification
        extend record
          abstract phase
    extend transition_type
      extend specification
        extend record
          abstract nature
