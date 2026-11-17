// ---- half-adder: the proof model of logic-circuit — two input
//      ports (a, b), two output ports (s, c), an xor gate and an and
//      gate, six wires. The n-ary reading is lived here: each gate
//      takes its two incoming wires.
layer half-adder refines @logic-circuit
  extend gates
    xorg refines @logic-circuit/specification/xor_gate_type
      identifier = 1
    andg refines @logic-circuit/specification/and_gate_type
      identifier = 2
  extend ports
    a refines @logic-circuit/specification/port_type
      identifier = 1
      direction = "in"
    b refines @logic-circuit/specification/port_type
      identifier = 2
      direction = "in"
    s refines @logic-circuit/specification/port_type
      identifier = 3
      direction = "out"
    c refines @logic-circuit/specification/port_type
      identifier = 4
      direction = "out"
  extend wires
    w1 refines @logic-circuit/specification/wire_type
      identifier = 1
      source = @half-adder/ports/a
      target = @half-adder/gates/xorg
    w2 refines @logic-circuit/specification/wire_type
      identifier = 2
      source = @half-adder/ports/b
      target = @half-adder/gates/xorg
    w3 refines @logic-circuit/specification/wire_type
      identifier = 3
      source = @half-adder/ports/a
      target = @half-adder/gates/andg
    w4 refines @logic-circuit/specification/wire_type
      identifier = 4
      source = @half-adder/ports/b
      target = @half-adder/gates/andg
    w5 refines @logic-circuit/specification/wire_type
      identifier = 5
      source = @half-adder/gates/xorg
      target = @half-adder/ports/s
    w6 refines @logic-circuit/specification/wire_type
      identifier = 6
      source = @half-adder/gates/andg
      target = @half-adder/ports/c
  tests
    expect gates/xorg/kind = "xor"
    expect gates/andg/kind = "and"
    expect ports/a/direction = "in"
    expect wires/w1/source = @half-adder/ports/a
    expect ports/s/direction = "out"
