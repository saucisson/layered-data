// ---- l'espace temporisé — zone-statespace : l'espace d'états d'un
//      TPN en domaines de tir (la classe d'état : à chaque état, le
//      domaine des horloges des transitions activées). L'idiome est
//      celui du tronc : le réseau est un slot (pétinet temporisé
//      lié par la couche lisante), l'état porte son delta — ici le
//      domaine de tir, ajouté au type d'état.
layer zone-statespace refines @petrinet-statespace
  extend specification
    extend state_type
      abstract firing_domain
