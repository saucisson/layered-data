// ---- axe sûreté — safe-petrinet : le marquage de chaque place est
//      borné à 1 (réseau sauf). Idiome de weighted-hypergraph : la
//      borne par défaut vit sur le nœud du type, le slot dans le
//      record — une place, un modèle ou une famille peut re-déclarer
//      (override) la sienne. La contrainte est portée par les
//      données : ce n'est pas un check, c'est le contrat du type.
layer safe-petrinet refines @petrinet-scheme
  extend specification
    extend place_type
      bound = 1
      extend specification
        extend record
          abstract bound
