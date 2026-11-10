// The bedrock corpus loader of the browser build: one `.ld` file per
// layer, resolved at construction by the Vite glob (raw imports).
// The kernel folder is the single source of the corpus: no embedded
// copy. The Node harness reads the same files with plain fs — both
// feed the same assembly.

/** Read the raw sources of the kernel corpus, keyed by layer name
 * (file name without the `.ld` extension). */
export function loadKernelLayerSources(): Record<string, string> {
  const globImports = import.meta.glob("../../formalisms/kernel/*.ld", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const layerSources: Record<string, string> = {};
  for (const [globPath, source] of Object.entries(globImports)) {
    const fileName = globPath.split("/").pop() ?? "";
    const layerName = fileName.endsWith(".ld") ? fileName.slice(0, -".ld".length) : fileName;
    layerSources[layerName] = source;
  }
  return layerSources;
}

/** Read the raw sources of the tutorial corpus — the same contract
 * as the kernel loader, on the dedicated folder: ten simpler
 * layers the tutorial page flattens, never mixed into the bedrock
 * corpus. */
export function loadTutorialLayerSources(): Record<string, string> {
  const globImports = import.meta.glob("../../formalisms/tutorial/*.ld", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const layerSources: Record<string, string> = {};
  for (const [globPath, source] of Object.entries(globImports)) {
    const fileName = globPath.split("/").pop() ?? "";
    const layerName = fileName.endsWith(".ld") ? fileName.slice(0, -".ld".length) : fileName;
    layerSources[layerName] = source;
  }
  return layerSources;
}
