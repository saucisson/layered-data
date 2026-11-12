// ---- axe acceptation — omega-automaton : l'automate sur les mots
//      infinis. La condition d'acceptation est un slot sur le type
//      d'état, la spécialisation la pose : buchi-automaton et
//      parity-automaton ci-dessous la tranchent. L'axe énonce, les
//      raffinements nomment — l'idiome de la partition k-partite.
layer omega-automaton refines @automaton-scheme
  extend specification
    extend state_type
      extend specification
        extend record
          abstract acceptance
