// ---- le feu de Büchi — buchi-traffic-light : le feu du tronc croisé
//      avec l'axe acceptation (modèle d'abord, axe ensuite — l'idiome
//      de spn-philosophers-5). Le feu tourne en cycle, toute course
//      y est infinie : sa question est celle de la visite — le vert
//      infiniment souvent. Un seul état acceptant posé (le slot du
//      parent est absent ailleurs : rouge et ambre ne le posent pas,
//      la lecture carotte). La sortie héritée descend par la
//      fermeture : la donnée du feu ne se réécrit pas, l'axe
//      l'annote.
layer buchi-traffic-light refines @moore-traffic-light then @buchi-automaton
  extend states
    green refines @moore-traffic-light/states/green
      accepting = true
  tests
    expect states/green/accepting = true
    expect states/red/accepting absent
    expect states/amber/accepting absent
    expect states/green/output = "go"
    expect states/green/acceptance = "buchi"
