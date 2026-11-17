// ---- logic-circuit: combinational logic circuits as a DAG —
//      n-ary gates (the arity is the count of incoming wires,
//      derived, not declared), input and output ports, wires between
//      them. A gate is a vertex, a wire an edge: the circuit is a dag
//      whose vertices are gates and ports. Each gate kind is its own
//      type (and_gate_type, or_gate_type, …) posing its `kind`, so a
//      lens can dress each kind with its own shape.
layer logic-circuit refines @dag
  extend specification
    gate_type refines @logic-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract kind
    and_gate_type refines @logic-circuit/specification/gate_type
      kind = "and"
    or_gate_type refines @logic-circuit/specification/gate_type
      kind = "or"
    not_gate_type refines @logic-circuit/specification/gate_type
      kind = "not"
    xor_gate_type refines @logic-circuit/specification/gate_type
      kind = "xor"
    nand_gate_type refines @logic-circuit/specification/gate_type
      kind = "nand"
    nor_gate_type refines @logic-circuit/specification/gate_type
      kind = "nor"
    port_type refines @logic-circuit/specification/vertex_type
      extend specification
        extend record
          override abstract identifier
          abstract direction
    wire_type refines @logic-circuit/edge_type
      extend specification
        extend record
          override abstract identifier
          extend source
            override container = @logic-circuit/vertices
          extend target
            override container = @logic-circuit/vertices
  gates refines @collection
    extend specification
      extend collection
        override type = @logic-circuit/specification/gate_type
  ports refines @collection
    extend specification
      extend collection
        override type = @logic-circuit/specification/port_type
  wires refines @collection
    extend specification
      extend collection
        override type = @logic-circuit/specification/wire_type
  extend vertices refines @logic-circuit/gates then @logic-circuit/ports
  extend edges refines @logic-circuit/wires
