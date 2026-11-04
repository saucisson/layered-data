// ---- un état de l'espace du dîner — ss-pn-philosophers-5-inst :
//      s1 ne pose que son delta (philo1.think1 = 2) — le membre du
//      delta CITE le template par le chemin qui traverse la citation
//      du dîner (même chemin que le membre généré) : le marking
//      qu'il surcharge existe en amont, dans le template. Les
//      autres marquages se lisent aux adresses du dîner, héritées à
//      travers le type d'état. b1 : une liaison — sa transition est
//      la philo1.take1 du dîner, générée par la citation, liée
//      tard. Refines explicites : l'espace principal ne joue pas le
//      désucrage (pousser le type de la collection dans chaque
//      enfant donnerait la même fermeture).
layer ss-pn-philosophers-5-inst refines @ss-pn-philosophers-5
  extend states
    s1 refines @petrinet-statespace/specification/state_type
      extend places
        extend philo1.think1 refines @pn-philosophers-5/philosophes/philo1/places/think1
          override marking = 2
  extend alphabet
    b1 refines @petrinet-statespace/behavior/specification/binding_type
      transition = @petrinet-statespace/petrinet/transitions/philo1.take1
