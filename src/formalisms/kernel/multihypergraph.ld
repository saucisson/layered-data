// ---- la base — multihypergraph : les formalismes se définissent
//      par restriction d'un formalisme plus général — la généralité
//      est la base. Des sommets et des arêtes, typés (identifier) et
//      stockés dans deux collections à clés ; l'incidence est
//      portée : chaque arête pointe ses sommets par des flèches
//      (arrow_type), en nombre quelconque — l'arité libre est la loi
//      de la base. La multiplicité est la normalité non marquée du
//      mécanisme : les arêtes sont identifiées par clé, pas par
//      leurs extrémités, et le même ensemble d'extrémités peut être
//      relié plusieurs fois. Une permission par défaut ne porte pas
//      de nom ; seul son contraire restreint en aura un
//      (hypergraph, ci-dessous).
layer multihypergraph refines @record
  // le vocabulaire de la base est une liaison de données (clé
  // spéciale « bindings ») : les checks génériques ne lisent pas
  // ces noms en dur, ils lisent les slots — la base les lie. Un
  // raffinement qui renomme re-lie le slot, le check suit la vue.
  bind vertices -> "vertices"
  bind edges -> "edges"
  bind ordered -> false
  bind arrows -> "arrows"
  bind arrow-vertex -> "vertex"
  extend specification
    vertex_type refines @record
      extend specification
        extend record
          abstract identifier
    edge_type refines @record
      extend specification
        extend record
          abstract identifier
      // une flèche pointe un sommet de la base
      arrow_type refines @record
        extend specification
          extend record
            vertex
              container = @multihypergraph/vertices
      arrows refines @collection
        extend specification
          extend collection
            override type = @multihypergraph/specification/edge_type/arrow_type
  vertices refines @collection
    extend specification
      extend collection
        override type = @multihypergraph/specification/vertex_type
  edges refines @collection
    extend specification
      extend collection
        override type = @multihypergraph/specification/edge_type
