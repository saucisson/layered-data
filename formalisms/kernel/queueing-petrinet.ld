// ---- axe files — queueing-petrinet : le QPN de Bause. Le coloré
//      porte les jetons (classes, domaines, inscriptions), la place
//      devient une file : les jetons y attendent selon une discipline
//      (FIFO, LIFO, PS — la valeur est une donnée), la capacité borne
//      la file ; le dépôt sur file pleine se discute, la politique
//      vit dans l'instance. Pas de défaut : une place sans discipline
//      est une place du coloré, la file absente — le P/T en est le
//      cas dégénéré.
layer queueing-petrinet refines @colored-petrinet
  extend specification
    extend place_type
      extend specification
        extend record
          abstract queueing_discipline
          abstract queue_capacity
