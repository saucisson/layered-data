// ---- le registre des checks — le métamodèle rentré chez lui
//      (ADR-0019). La langue POSE les contraintes (« check simple,
//      nonempty ») ; leur sens vivait en TypeScript, déplacé hors
//      des données qu'il décrit. Ici, chaque étiquette déclare son
//      CONTRAT : où elle juge (« level » : la racine d'une couche,
//      ou l'instance — le type qui la pose est dans la fermeture de
//      l'instance, jamais de la racine) ; les slots sans lesquels
//      elle ne peut pas juger (« required », avec le niveau où
//      chacun se lit) ; ceux qu'elle lit quand ils sont liés
//      (« optional », jamais exigés) ; le groupe conditionnel dont
//      les slots dépendent d'une liaison (« conditional » : la
//      condition « slot », la vue opérande « operand », et les deux
//      branches « true » / « false »). Le noyau lit ces adresses
//      mêmes — @check-registry/specification/<étiquette> : la
//      donnée est la seule source, la table TypeScript est morte.
//
//      La couche se tient DEBOUT : aucun raffinement. Le
//      métamodèle ne descend pas du modèle qu'il décrit — et
//      hériter de @record mettrait son « record » dans la fermeture
//      du registre (mesuré) : le lecteur verrait une dixième
//      étiquette fantôme. Les clés se déclarent en mode neuf,
//      comme celles de « record » : l'extension exige un
//      fournisseur, et le registre n'en a pas.
layer check-registry
  specification
    // les deux checks génériques du noyau d'origine : aucun slot —
    // ils lisent les vues « specification » telles quelles. Portés
    // par rien dans le tronc (mesuré), ils restent au registre :
    // le registre documente le noyau, pas son usage.
    containers
      level = "root"
    cardinality
      level = "root"
    // le check des hypergraphes purs : le groupe conditionnel suit
    // la liaison « ordered » — vraie, il lui faut la paire ordonnée
    // (lue à l'instance, aux adresses de la vue opérande) ; fausse
    // ou non liée, les flèches (lues à la racine).
    simple
      level = "root"
      required
        edges = "root"
      optional
        ordered = "root"
      conditional
        slot = "ordered"
        operand = "edges"
        true
          end-source = "instance"
          end-target = "instance"
        false
          arrows = "root"
          arrow-vertex = "root"
    nonempty
      level = "root"
      required
        edges = "root"
        arrows = "root"
        arrow-vertex = "root"
    oriented
      level = "instance"
      required
        end-source = "instance"
        end-target = "instance"
    sperner
      level = "root"
      required
        edges = "root"
        arrows = "root"
        arrow-vertex = "root"
    k-partite
      level = "root"
      required
        vertices = "root"
        edges = "root"
        arrows = "root"
        arrow-vertex = "root"
    dag
      level = "instance"
      required
        end-source = "instance"
        end-target = "instance"
    arbre
      level = "root"
      required
        vertices = "root"
        edges = "root"
      optional
        end-source = "instance"
        end-target = "instance"
