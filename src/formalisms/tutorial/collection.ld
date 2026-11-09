// ---- the tutorial's keyed collection: four open slots
//      (type, container, minimum, maximum) — members are keys, the
//      type says what a member must refine, and the bounds feed the
//      cardinality check.
layer collection
  specification
    collection
      abstract type
      abstract container
      abstract minimum
      abstract maximum
