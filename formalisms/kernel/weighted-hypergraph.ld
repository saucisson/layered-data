// ---- axe attributs — weighted-hypergraph : un slot weight sur
//      l'arête, avec défaut 1 (membre du père au même chemin). Le
//      poids est un axe d'annotation, orthogonal à l'orientation :
//      le slot vit sur son propre membre, aucune clé ne fuit vers
//      les modèles. Le diamant en dépend : weighted-bipartite =
//      [bipartite-digraph, weighted-hypergraph], le poids descend
//      toujours par la seconde voie du diamant.
layer weighted-hypergraph refines @edge-annotated-hypergraph
  extend edge_type
    weight = 1
    extend specification
      extend record
        abstract weight
