// Kahn lens: same multi-LRef [generic, family scheme]
layer kahn-display refines @graph-display then @kahn-scheme
  extend specification
    extend process_type
      extend display
        override shape = "box"
        label = "identifier"
    extend channel_type
      extend display
        override shape = "box"
        label = "capacity"
    extend write_type
      extend display
        override shape = "line"
        override arrow = "plain"
        override stroke = "#455555"
    extend read_type
      extend display
        override shape = "line"
        override arrow = "plain"
        override stroke = "#455555"
