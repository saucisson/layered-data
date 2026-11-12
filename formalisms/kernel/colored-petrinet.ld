// ---- axe couleurs — colored-petrinet : le haut niveau (HLPN, ISO
//      15909-3). Les couleurs sont des données : une collection
//      color_classes (une classe = un cardinal), chaque place porte
//      un domaine (produit de classes, désignation tardive vers la
//      collection), chaque transition des variables et une garde,
//      chaque arc une inscription à variables — l'annotation de
//      l'arête (edge-annotated) devient un terme. Le schéma P/T
//      garde sa partition : un réseau coloré raffiné EST un réseau
//      de Petri, le marquage entier en est le cas dégénéré.
layer colored-petrinet refines @petrinet-scheme
  color_classes refines @collection
    extend specification
      extend collection
        override type = @colored-petrinet/specification/color_type
  extend specification
    color_type refines @record
      extend specification
        extend record
          abstract cardinality
    extend place_type refines @petrinet-scheme/specification/place_type
      extend specification
        extend record
          abstract color_domain
    extend transition_type refines @petrinet-scheme/specification/transition_type
      extend specification
        extend record
          abstract variables
          abstract guard
  // l'axe inscription : même chemin que la racine multidigraph::edge_type
  extend edge_type
    extend specification
      extend record
        abstract inscription
