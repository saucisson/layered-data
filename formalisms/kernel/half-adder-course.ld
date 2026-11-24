// concrete viewpoint: the half-adder through the circuit lens +
//      positions — a and b on the left, the xor and and gates in the
//      middle, s and c on the right, the wires read left to right like
//      an adder scheme
layer half-adder-course refines @view-scheme
  override model = @half-adder
  override display = @logic-circuit-display
  override zoom = "mecanisme"
  positions
    a
      x = 60
      y = 60
    b
      x = 60
      y = 160
    xorg
      x = 210
      y = 60
    andg
      x = 210
      y = 160
    s
      x = 360
      y = 60
    c
      x = 360
      y = 160
  tests
    expect model = @half-adder
    expect display = @logic-circuit-display
    expect zoom = "mecanisme"
    expect positions/a/x = 60
    expect positions/a/y = 60
    expect positions/b/x = 60
    expect positions/b/y = 160
    expect positions/xorg/x = 210
    expect positions/xorg/y = 60
    expect positions/andg/x = 210
    expect positions/andg/y = 160
    expect positions/s/x = 360
    expect positions/s/y = 60
    expect positions/c/x = 360
    expect positions/c/y = 160
