// lentille Petri : MULTI-LRef [lentille générique, schéma]
layer petrinet-display refines @graph-display then @petrinet-scheme
  extend specification
    extend place_type
      extend display
        override shape = "ellipse"
        label = "identifier"
        override fill = "#ffffff"
        override stroke = "#455555"
    extend transition_type
      extend display
        override shape = "rectangle"
        label = "identifier"
        override fill = "#455555"
        override stroke = "#455555"
    extend arc_type
      extend display
        override shape = "line"
        override arrow = "plain"
        ports = 2
        override stroke = "#455555"
