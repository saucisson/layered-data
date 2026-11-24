// ---- axe départ — initial-automaton : l'état initial. Le tronc est
//      un graphe d'états qui se parcourt depuis partout (le feu de
//      Moore ne le pose pas) ; l'automate fini le pose : au plus un
//      état initial, la course du mot y commence. Idiome de
//      weighted-hypergraph : le défaut vit sur le nœud du type (tout
//      état non raffiné n'est pas initial), le slot dans le record —
//      l'instance pose le sien, la lecture carotte. Plusieurs
//      initiaux ? Une couche au-dessus re-déclarerait (override) — le
//      schéma n'hypothèse pas.
layer initial-automaton refines @automaton-scheme
  extend specification
    extend state_type
      initial = false
      extend specification
        extend record
          abstract initial
