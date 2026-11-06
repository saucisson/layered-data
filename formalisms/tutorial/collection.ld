// ---- la collection à clés du tutoriel : quatre slots ouverts
//      (type, container, minimum, maximum) — les membres sont des
//      clés, le type dit ce qu'un membre doit raffiner, et les
//      bornes nourrissent le check cardinality.
layer collection
  specification
    collection
      abstract type
      abstract container
      abstract minimum
      abstract maximum
