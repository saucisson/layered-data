// ---- the ℕ bound case — pt-multiset: the multiset of a P/T net.
//      Element multiplicities are natural integers: zero = empty bag,
//      plus = sum of multiplicities, times = scalar multiplication.
//      This is the multiset that a place's marking and an arc's
//      inscription are, in a place/transition net.
layer pt-multiset refines @multiset
  extend specification
    extend multiset
      override zero = 0
      override plus = "add"
      override times = "mul"
