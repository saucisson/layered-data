// ---- l'espace du dîner stochastique — ss-spn-philosophers-5 :
//      l'idiome du tronc (ss-pn-philosophers-5) sur l'espace CTMC —
//      le slot petrinet posé à spn-philosophers-5, tout lecteur
//      au-dessus ou en dessous le résoudra tard. L'état lit les
//      marquages aux adresses du dîner, la CTMC s'ensuit.
layer ss-spn-philosophers-5 refines @ctmc-statespace
  override petrinet = @spn-philosophers-5
  tests
    expect petrinet = @spn-philosophers-5
