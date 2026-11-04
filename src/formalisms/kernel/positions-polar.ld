// ---- le pôle — positions-polar : distance r et angle
//      theta — theta en degrés, zéro à l'est, sens horaire
//      du dessin (le y descend) ; z monte le plan en
//      cylindre
layer positions-polar refines @positions-scheme
  extend specification
    extend position_type
      extend specification
        extend record
          override system = "polar"
