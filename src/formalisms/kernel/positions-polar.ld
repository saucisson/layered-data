// ---- the pole — positions-polar: distance r and angle
//      theta — theta in degrees, zero east, clockwise in drawing
//      sense (y goes down); z lifts the plane into a cylinder
layer positions-polar refines @positions-scheme
  extend specification
    extend position_type
      extend specification
        extend record
          override system = "polar"
