// point de vue sur le diamant — wb1 par la lentille générique,
// mêmes idiomes que pn-philosophers-5-course (positions = décisions
// du point de vue). Les poids y sont lus à travers le diamant (e1
// porte 3, e2 hérite 1).
layer wb-course refines @view-scheme
  override model = @wb1
  override display = @graph-display
  override zoom = "aplati"
  positions
    a1
      x = 60
      y = 55
    a2
      x = 60
      y = 165
    b1
      x = 210
      y = 110

