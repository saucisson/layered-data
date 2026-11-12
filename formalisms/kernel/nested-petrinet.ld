// ---- axe jetons-réseaux — nested-petrinet : les jetons sont des
//      réseaux (nets-within-nets). Le slot element_net est une
//      désignation tardive vers une couche modèle : la valeur est
//      une couche entière (LRef), résolue par la couche lisante —
//      un objet peut évoluer dans le réseau-hôte en gardant sa
//      propre structure adressable.
layer nested-petrinet refines @petrinet-scheme
  extend specification
    extend place_type
      extend specification
        extend record
          abstract element_net
