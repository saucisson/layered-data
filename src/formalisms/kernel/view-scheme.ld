// generic viewpoint scheme. Lens checks are not carried into the
// kernel: only the two generic checks (containers, cardinality)
// live there.
layer view-scheme refines @record
  abstract model
  // the model being viewed
  abstract display
  // the lens
  abstract zoom
  // the reading level
