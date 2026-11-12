// ---- multiset: a bag over an element type — the algebraic view:
//      a multiset on T is a function T → ℕ (each element carries its
//      multiplicity). The slots are the algebra's operations:
//      zero is the empty bag, plus is the weighted union (multiplicities
//      add), times is the scalar product. element_type is the carrier
//      set; the multiplicity type is fixed to ℕ by pt-multiset below.
layer multiset
  specification
    multiset
      abstract element_type
      abstract zero
      abstract plus
      abstract times
