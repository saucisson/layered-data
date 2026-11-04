// ---- dag — acyclicité. Aucun modèle du tronc ne raffine cette
//      couche : le label ne tire pas au-delà de sa déclaration.
layer dag refines @multidigraph
  extend edge_type
    check dag
