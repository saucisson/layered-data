// ---- acceptation parité — parity-automaton : chaque état porte une
//      priorité, le mot infini est accepté selon la priorité la plus
//      haute vue infiniment souvent. La mesure se lit sur TOUTES
//      les acceptations à la fois : la valeur du slot tranchée
//      ici, la priorité posée dans priority — les deux vivent dans
//      la même fermeture.
layer parity-automaton refines @omega-automaton
  extend specification
    extend state_type
      extend specification
        extend record
          override acceptance = "parity"
          abstract priority
