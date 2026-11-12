// ---- le dîner lumpé — lumped-dinner-5 : l'idiome du tronc
//      (ss-pn-philosophers-5) sur la chaîne lumpée — le slot petrinet
//      posé à swn-philosophers-5, tout lecteur au-dessus ou en dessous
//      le résoudra tard. L'état porte ses sous-classes dynamiques, son
//      marquage symbolique, sa cardinalité d'orbite et sa mesure
//      stationnaire — les cinq philosophes interchangeables y
//      agrègent leurs états par orbite : le dîner concret compte
//      onze marquages (les ensembles indépendants du cycle C5), la
//      chaîne lumpée en compte trois (tous pensent, l'un mange, deux
//      mangent).
layer lumped-dinner-5 refines @symbolic-ctmc
  override petrinet = @swn-philosophers-5
  tests
    expect petrinet = @swn-philosophers-5
