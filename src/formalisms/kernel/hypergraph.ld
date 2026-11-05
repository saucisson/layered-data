// ---- la restriction nommée — hypergraph : le multihypergraphe
//      pur. E est un ensemble de parties non vides : arêtes uniques
//      (pas deux arêtes pour le même ensemble d'extrémités), pas de
//      répétition intra-arête (une arête est un ensemble, pas un
//      multiensemble — les singletons restent légaux : les exclure
//      serait une couche loopless-hypergraph, non posée).
//
//      ADR-0022 : la contrainte est un COUPLE — définir un check,
//      c'est aussi le poser. La formule parle le vocabulaire du
//      définisseur (edges, arrows, vertex) et se lit telle quelle
//      dans tous les descendants ; l'univers d'une formule est le
//      vocabulaire déclaré de celui qui l'écrit, jamais un nom de
//      couche. La branche suit la liaison « ordered » (le seul
//      paramètre-valeur du socle, lié par la base et par
//      multidigraph) : fausse, l'arête est un ensemble d'extrémités
//      — répétition intra-arête puis arêtes multiples ; vraie, la
//      paire ordonnée des champs — boucle puis arcs parallèles. Un
//      terme en position de proposition est le prédicat d'existence
//      (une flèche peut ne pas dénoter) : les gardes l'énoncent,
//      jamais un slot. Une arête sans flèche dénotante est vide —
//      c'est la loi de la base, renvoyée ici par « nonempty ».
layer hypergraph refines @multihypergraph
  check simple
    level = "root"
    condition = "ordered"
    judgment
      when = "false"
      formula = "forall e in edges: forall a1, a2 in e/arrows: (not a1/vertex) or (not a2/vertex) or (a1 = a2) or (a1/vertex != a2/vertex)"
      message = "simple: sommet répété ({e} : {a1/vertex*})"
    judgment
      when = "false"
      formula = "forall e1, e2 in edges: (e1 = e2) or (not (exists a in e1/arrows: a = a)) or (not (exists a in e2/arrows: a = a)) or (not ((forall v in vertices: ((exists a1 in e1/arrows: a1/vertex = v) => (exists a2 in e2/arrows: a2/vertex = v))) and (forall v in vertices: ((exists a1 in e2/arrows: a1/vertex = v) => (exists a2 in e1/arrows: a2/vertex = v)))))"
      message = "simple: arête multiple ({e1} == {e2})"
    judgment
      when = "true"
      formula = "forall e in edges: ((e/source) and (e/target)) => (not (e/source = e/target))"
      message = "simple: boucle ({e} : {e/source*})"
    judgment
      when = "true"
      formula = "forall e1, e2 in edges: (e1 = e2) or (not e1/source) or (not e1/target) or (not e2/source) or (not e2/target) or (not ((e1/source = e2/source) and (e1/target = e2/target)))"
      message = "simple: arête multiple ({e1} == {e2} : ({e1/source*}, {e2/target*}))"
  check nonempty
    level = "root"
    judgment
      formula = "forall e in edges: exists a in e/arrows: a/vertex"
      message = "nonempty: arête vide ({e})"
