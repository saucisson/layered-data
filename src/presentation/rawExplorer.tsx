// The raw explorer: the compilation tree of one layer, key after
// key, indentation showing the nesting — the raw dictionary the
// compiler emits, before any reading (this is the "brut" of the
// workshop, for teaching what the kernel actually holds).

import React from "react";
import { type LayerName } from "../domain/identifiers.ts";
import { LayerReference, PathReference, isDictionary } from "../domain/addresses.ts";
import { SPECIAL_KEYS } from "../domain/specialKeys.ts";
import type { Space } from "../domain/space.ts";
import { KernelValue } from "./valueRendering.tsx";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** One key of the raw tree: a dictionary recurses, a refinement
 * list renders element by element (references never collapse into
 * `[object Object]`), a leaf shows its written value. */
function RawBranch({
  keyName,
  value,
  depth,
  language,
}: {
  keyName: string;
  value: any;
  depth: number;
  language: Language;
}) {
  const special = (SPECIAL_KEYS as readonly string[]).includes(keyName);
  const keyClassName = special ? "font-semibold text-amber-600" : "font-semibold text-slate-800 dark:text-slate-100";
  if (isDictionary(value)) {
    return (
      <div style={{ marginLeft: depth === 0 ? 0 : 12 }}>
        <span className={keyClassName}>{keyName}</span>
        <span className="text-slate-600"> : {"{"}</span>
        {Object.keys(value).map((childKey) => (
          <RawBranch
            key={childKey}
            keyName={childKey}
            value={value[childKey]}
            depth={depth + 1}
            language={language}
          />
        ))}
        <span className="text-slate-600">{"}"}</span>
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div style={{ marginLeft: depth === 0 ? 0 : 12 }}>
        <span className={keyClassName}>{keyName}</span>
        <span className="text-slate-600"> : [</span>
        {value.map((element, index) => (
          <div key={index} style={{ marginLeft: 12 }}>
            <KernelValue value={element} language={language} />
            {index < value.length - 1 ? <span className="text-slate-600">,</span> : null}
          </div>
        ))}
        <span className="text-slate-600">]</span>
      </div>
    );
  }
  let rendered: React.ReactNode;
  if (value instanceof PathReference) {
    rendered = (
      <span className="text-sky-700">
        → ({value.anchor}) {value.path.join("/")}
      </span>
    );
  } else if (value instanceof LayerReference) {
    rendered = <span className="text-sky-700">→ {value.layer}</span>;
  } else if (value === null) {
    rendered = (
      <span className="text-slate-600">
        {say({ language, en: "∅ abstract slot", fr: "∅ slot abstrait" })}
      </span>
    );
  } else {
    rendered = <span className="text-slate-800 dark:text-slate-100">{String(value)}</span>;
  }
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 12 }}>
      <span className={keyClassName}>{keyName}</span>
      <span className="text-slate-600"> : </span>
      {rendered}
    </div>
  );
}

/** The raw tree of one layer of the living space. */
export function RawLayerExplorer({
  space,
  layer,
  language,
}: {
  space: Space;
  layer: LayerName;
  language: Language;
}) {
  const node = space.layers[layer] ?? {};
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-mono text-[11px] leading-5">
      {Object.keys(node).map((key) => (
        <RawBranch key={key} keyName={key} value={node[key]} depth={0} language={language} />
      ))}
    </div>
  );
}
