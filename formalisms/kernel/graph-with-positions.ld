// ---- dérivation — graph-with-positions : un graphe dont les
//      sommets se posent — la composition du graphe et de la
//      grille ; les clés de la collection positions nomment les
//      sommets, la lentille les résout et les dessine (repli cercle
//      sans positions), la relative permet de dériver un graphe
//      d'un autre sans reposer ses points
layer graph-with-positions refines @graph then @positions-grid
