// ---- composition temps × poids — priced-timed-automaton : le LPTA
//      du model-checking coûté — le coût s'accumule linéairement :
//      chaque location porte son taux de dérive (le coût par unité
//      de temps passée), chaque transition son prix — le poids
//      hérité de l'axe pondéré devient le prix du saut, le taux vit
//      ici. Le temps d'abord (il contraint l'horloge), le poids
//      ensuite (il annote la course) — l'idiome de
//      probabilistic-timed-automaton, le reward en moins, le coût en
//      plus.
layer priced-timed-automaton refines @timed-automaton then @weighted-automaton
  extend specification
    extend state_type
      extend specification
        extend record
          abstract rate
