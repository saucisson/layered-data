// ---- variante liée — pn-philosophers-5-bounds-c1 : la borne 1
//      posée sur philo1.think1, à travers le dîner — la fermeture
//      traverse les cinq citations du template (15 places, 10
//      transitions) ; le membre qualifié est celui que la citation
//      a généré.
layer pn-philosophers-5-bounds-c1 refines @pn-philosophers-5-bounds
  extend places
    extend philo1.think1 refines @pn-philosophers/specification/think
      bound = 1
