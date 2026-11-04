// ---- multidigraph : l'orientation est un renommage des points de
//      connexion. Raffine named-ends-hypergraph (le tronc des
//      extrémités nommées) et pair-graph (la cardinalité 2, sans
//      rôles) : 2 flèches nommées source et target pointant les
//      champs de l'arête elle-même. Le nom est mathématique : la
//      base permet les arcs parallèles et les boucles, et ces deux
//      parents vivent du côté multi — c'est un multidigraphe.
//      Convention de nommage : arc (et le suffixe -digraph) à partir
//      d'ici ; edge/arête au-dessus de l'orientation.
layer multidigraph refines @named-ends-hypergraph then @pair-graph
  // l'idiome ordonné se lie ici (premier-gagné par slot : plus
  // spécifique que la base, il gagne dans toute la chaîne) — le
  // registre lit la liaison « ordered », jamais le nom de la
  // couche. Liaison de COUCHE : elle vit à la racine, où les
  // checks de couche la lisent.
  bind ordered -> true
  extend edge_type refines @multihypergraph/specification/edge_type
    // même chemin que la racine : redéfinition de l'arête du graphe
    // liaisons de TYPE : les checks d'arc (oriented, dag) et la
    // paire ordonnée lisent à l'adresse de l'arc — le type est dans
    // la fermeture de l'arc, la racine jamais. Les rôles
    // source/target vivent donc ici, à portée de lecture réelle.
    bind end-source -> "source"
    bind end-target -> "target"
    extend specification
      extend record
        source
          container = @multidigraph/vertices
        target
          container = @multidigraph/vertices
    extend arrows
      source
        vertex = @edge_type/source
      target
        vertex = @edge_type/target
