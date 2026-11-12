// ---- acceptation par paires — rabin-automaton : des paires
//      (gauche, droite) ; le mot est accepté s'il existe une paire
//      dont la gauche n'est visitée que finiment et la droite
//      infiniment. L'état siège par ses indices (rabin_left,
//      rabin_right). Streett est le dual (∀ au lieu de ∃, côtés
//      échangés) : les mêmes slots le porteraient, la valeur du slot
//      d'acceptation trancherait — la couche ne le dédouble pas.
layer rabin-automaton refines @omega-automaton
  extend specification
    extend state_type
      extend specification
        extend record
          override acceptance = "rabin"
          abstract rabin_left
          abstract rabin_right
