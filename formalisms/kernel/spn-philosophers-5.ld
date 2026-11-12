// ---- le dîner stochastique — spn-philosophers-5 : le dîner du tronc
//      croisé avec l'axe stochastique (modèle d'abord, axe ensuite —
//      l'ordre déclare la spécificité). Philo1 a un appétit double :
//      son take porte rate 1.5 ; les quatre autres n'en posent pas —
//      la lecture carotte : leur taux est absent, c'est la donnée.
//      Le firing_weight descend du défaut posé sur le nœud du type
//      (1.0 chez stochastic-petrinet) : aucun n'est posé ici, les
//      cinq transitions le lisent par la fermeture. Le contrat du
//      dîner (hérité) s'étend ici : la scène porte ses propres
//      attendus, la validation les rejoue.
layer spn-philosophers-5 refines @pn-philosophers-5 then @stochastic-petrinet
  extend transitions
    extend philo1.take1 refines @pn-philosophers/specification/take
      rate = 1.5
  extend tests
    expect transitions/philo1.take1/rate = 1.5
    expect transitions/philo1.take1/firing_weight = 1.0
    expect transitions/philo2.take1/rate absent
    expect transitions/philo1.release1/rate absent
    expect places/philo1.think1/marking = 1
