// The bedrock corpus loader of the browser build: one `.ld` file per
// layer, resolved at construction by the Vite glob (raw imports).
// The kernel folder is the single source of the corpus: no embedded
// copy. The Node harness reads the same files with plain fs — both
// feed the same assembly.

/** Layer name of a glob path: the file name without the `.ld`
 * extension. */
function layerNameOfGlobPath(globPath: string): string {
  const fileName = globPath.split("/").pop() ?? "";
  return fileName.endsWith(".ld") ? fileName.slice(0, -".ld".length) : fileName;
}

/** Key a glob result by layer name, in a canonical order: the glob
 * key order is not guaranteed, so the entries are sorted by layer
 * name — every downstream `Object.keys` is then stable across
 * reloads (issue #223). */
function sortedLayerSources({
  globImports,
}: {
  globImports: Record<string, string>;
}): Record<string, string> {
  const layerSources: Record<string, string> = {};
  const entries = Object.entries(globImports)
    .map(([globPath, source]) => ({ layerName: layerNameOfGlobPath(globPath), source }))
    .sort((first, second) =>
      first.layerName < second.layerName ? -1 : first.layerName > second.layerName ? 1 : 0,
    );
  for (const { layerName, source } of entries) {
    layerSources[layerName] = source;
  }
  return layerSources;
}

/** Read the raw sources of the kernel corpus, keyed by layer name
 * (file name without the `.ld` extension). */
export function loadKernelLayerSources(): Record<string, string> {
  return sortedLayerSources({
    globImports: import.meta.glob("../../formalisms/kernel/*.ld", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  });
}

/** Read the raw sources of the tutorial corpus — the same contract
 * as the kernel loader, on the dedicated folder: nine simpler
 * layers the tutorial page flattens, never mixed into the bedrock
 * corpus. */
export function loadTutorialLayerSources(): Record<string, string> {
  return sortedLayerSources({
    globImports: import.meta.glob("../../formalisms/tutorial/*.ld", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>,
  });
}
