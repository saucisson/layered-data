// ---- bornes du dîner — pn-philosophers-5-bounds : le champ bound
//      posé sur le type des places du dîner — la contrainte
//      descend jusqu'aux cinq citations du template.
layer pn-philosophers-5-bounds refines @pn-philosophers-5
  extend specification
    extend place_type
      extend specification
        extend record
          abstract bound
