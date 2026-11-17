// ---- logic-circuit lens: one shape per gate kind — and (flat-sided
//      box), or (ellipse), not (circle), xor/nand/nor keep the base
//      circle; the conventional IEEE shapes (D-shape AND, curved OR,
//      triangle NOT with bubble) arrive with the `path` glyph genre
//      (issue #284). Ports are small rectangles labeled by direction,
//      wires plain lines.
layer logic-circuit-display refines @graph-display then @logic-circuit
  extend specification
    extend gate_type
      extend display
        label = "kind"
        override fill = "#ffffff"
        override stroke = "#455555"
    extend and_gate_type
      extend display
        override shape = "box"
        override fill = "#ffffff"
        override stroke = "#455555"
    extend or_gate_type
      extend display
        override shape = "ellipse"
        override fill = "#ffffff"
        override stroke = "#455555"
    extend not_gate_type
      extend display
        override shape = "circle"
        override fill = "#ffffff"
        override stroke = "#455555"
    extend port_type
      extend display
        override shape = "rectangle"
        label = "direction"
        override fill = "#455555"
        override stroke = "#455555"
    extend wire_type
      extend display
        override shape = "line"
        override arrow = "plain"
        override stroke = "#455555"
