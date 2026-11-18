// ---- the node sizes — node-sizes: per-vertex scale and rotation,
//      posed as data exactly like the positions (issue #285). A
//      model (or a viewpoint) that refines this scheme carries a
//      `sizes` collection whose keys name the vertices; each entry
//      poses a `scale` factor and/or an `angle` in degrees. The
//      cascade is the positions' one: the viewpoint decides, else
//      the model carries, else the gabarit's defaults apply — a node
//      without a datum keeps the template's sizes. The editor's
//      resize/rotate handles write this block.
layer node-sizes refines @record
  extend specification
    size_type refines @record
      extend specification
        extend record
          abstract scale
          abstract angle
  sizes refines @collection
    extend specification
      extend collection
        override type = @node-sizes/specification/size_type
