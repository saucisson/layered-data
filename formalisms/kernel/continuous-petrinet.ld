// ---- axe continu — continuous-petrinet : le fluide. Les places
//      portent des niveaux réels (le marking entier devient le cas
//      dégénéré discret), les transitions des débits constants ; la
//      sémantique d'activation (fractionnelle, à seuil) vit dans
//      l'instance, pas dans le schéma.
layer continuous-petrinet refines @petrinet-scheme
  extend specification
    extend place_type
      extend specification
        extend record
          abstract fluid_level
    extend transition_type
      extend specification
        extend record
          abstract flow_rate
