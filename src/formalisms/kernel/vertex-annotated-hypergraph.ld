// ---- axe annotation (sommets) — vertex-annotated-hypergraph :
//      un slot générique « annotation » sur le vertex_type, type non
//      lié — chaque famille le fixera dans son raffinement (le
//      marking des réseaux de Petri en est l'exemple). Membre du
//      père au même chemin : pas de refines, la fermeture du père
//      fusionne avec la base :: specification/vertex_type. Hoisé
//      directement sous la base : annoter n'oriente pas.
layer vertex-annotated-hypergraph refines @multihypergraph
  extend specification
    extend vertex_type
      extend specification
        extend record
          abstract annotation
