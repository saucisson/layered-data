// ---- acceptation de Büchi généralisée — generalized-buchi-automaton :
//      finit plusieurs parties acceptantes ; le mot est accepté si
//      CHACUNE est visitée infiniment souvent. La couche raffine le
//      Büchi du parent et multiplie ses parties : l'état siège dans
//      zéro, une ou plusieurs parties (le slot accepting_in porte
//      les indices) — le cas à une partie est le Büchi du parent
//      (accepting), la fermeture le lit. L'idiome est celui du tronc :
//      la valeur du slot tranchée (override), la donnée posée à côté.
layer generalized-buchi-automaton refines @buchi-automaton
  extend specification
    extend state_type
      extend specification
        extend record
          override acceptance = "generalized-buchi"
          abstract accepting_in
