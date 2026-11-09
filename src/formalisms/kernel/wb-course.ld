// viewpoint on the diamond — wb1 through the generic lens, same
// idioms as pn-philosophers-5-course (positions = the viewpoint's
// decisions). Weights are read through the diamond (e1 carries 3,
// e2 inherits 1).
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

