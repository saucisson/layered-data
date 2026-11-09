// ---- the dinner's state space — ss-pn-philosophers-5:
//      parameterized — the petrinet slot posed to pn-philosophers-5
//      (LRef as value, not a refines): any reader, above or below,
//      will resolve it late.
layer ss-pn-philosophers-5 refines @petrinet-statespace
  override petrinet = @pn-philosophers-5
