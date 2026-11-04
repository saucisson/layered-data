// ---- l'espace d'états du dîner — ss-pn-philosophers-5 :
//      paramétré — le slot petrinet posé à pn-philosophers-5 (LRef
//      en valeur, pas un refines) : tout lecteur, au-dessus ou en
//      dessous, le résoudra tard.
layer ss-pn-philosophers-5 refines @petrinet-statespace
  override petrinet = @pn-philosophers-5
