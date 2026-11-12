// ---- axe poids dynamiques — self-modifying-petrinet : le poids d'un
//      arc peut lire le marquage d'une place (VCPN, PCN — l'arc
//      pèse ce que la place contient). La référence est une
//      désignation tardive : le slot lit une place du réseau
//      lisant, résolue à la lecture (O6), jamais à la pose.
layer self-modifying-petrinet refines @petrinet-scheme
  extend edge_type
    extend specification
      extend record
        abstract dynamic_weight
