// ---- axe observation — labelled-petrinet : chaque transition porte
//      une étiquette d'action (le vocabulaire du langage du réseau :
//      équivalences de trace, produit synchronisé). Pas de défaut —
//      une transition muette est une transition silencieuse, le
//      slot absent.
layer labelled-petrinet refines @petrinet-scheme
  extend specification
    extend transition_type
      extend specification
        extend record
          abstract label
