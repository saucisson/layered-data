// schéma générique de point de vue. Les checks de lentille ne
// sont pas portés dans le noyau : seuls les deux checks génériques
// (conteneurs, cardinalité) y vivent.
layer view-scheme refines @record
  abstract model
  // le modèle regardé
  abstract display
  // la lentille
  abstract zoom
  // le niveau de lecture
