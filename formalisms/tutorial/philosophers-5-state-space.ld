// ---- le second modèle du tutoriel : l'espace d'états DU dîner.
//      Une seule ligne d'écriture pour tout l'espace : override
//      net = @philosophers-5 — la liaison est TARDIVE, le slot est
//      résolu par la couche qui lit. Puis un état posé : initial ne
//      pose que son delta (philo1.think marking = 2, un jeton de
//      plus), le reste se lit à travers le type d'état, hérité du
//      réseau ; et une liaison posée : b1 désigne la transition
//      philo1.take du dîner, générée par la citation, liée tard.
layer philosophers-5-state-space refines @state-space
  override net = @philosophers-5
  extend states
    initial refines @state-space/specification/state_type
      extend places
        extend philo1.think refines @philosophers-5/philosophes/philo1/places/think
          override marking = 2
  extend alphabet
    b1 refines @state-space/specification/binding_type
      transition = @state-space/net/transitions/philo1.take
  tests
    expect states/initial/places/philo1.think/marking = 2
    expect alphabet/b1/transition = @philosophers-5/transitions/philo1.take
