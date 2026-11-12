// The kernel value renderers: the small display atoms that turn a
// kernel value (address view, reference, scalar) into styled
// text — never `[object Object]`. Every label is bilingual: the
// kernel codes (statuses, vias) render through the vocabulary, the
// composed ones through say().

import { AddressView, LayerReference, PathReference, isDictionary } from "../domain/addresses.ts";
import { say } from "./i18n.ts";
import { labelOf } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** One address as a single text: `layer :: path`. */
export function addressText(address: [string, string[]]): string {
  return address[0] + " :: " + (address[1].length ? address[1].join("/") : "()");
}

/** Render one kernel value: a resolved node (address view), a
 * written reference, an abstract slot, or a scalar. */
export function KernelValue({ value, language }: { value: any; language: Language }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-slate-600">
        {say({ language, en: "∅ undefined"})}
      </span>
    );
  }
  if (value instanceof AddressView) {
    return (
      <span className="font-medium text-emerald-700">
        {say({ language, en: "node → "})}
        {value.layer} :: {value.path.length ? value.path.join("/") : "()"}
      </span>
    );
  }
  if (value instanceof PathReference) {
    return (
      <span className="text-sky-700">
        → ({value.anchor}) {value.path.join("/")}
      </span>
    );
  }
  if (value instanceof LayerReference) {
    return <span className="text-sky-700">→ {value.layer}</span>;
  }
  return <span className="font-medium text-slate-900">{String(value)}</span>;
}

/** Render one flattened value: a value dictionary (the bindings of
 * a check, for instance) goes slot → value on one line. */
export function FlatValue({ value, language }: { value: any; language: Language }) {
  if (isDictionary(value)) {
    return (
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {Object.keys(value).map((slot, index) => (
          <span key={slot}>
            {index > 0 ? ", " : ""}
            {slot} → <FlatValue value={value[slot]} language={language} />
          </span>
        ))}
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <span>
        {value.map((item, index) => (
          <span key={index}>
            {index > 0 ? ", " : ""}
            <FlatValue value={item} language={language} />
          </span>
        ))}
      </span>
    );
  }
  return <KernelValue value={value} language={language} />;
}

// ------------------------------------------------------- trace events

/** One path prefix as text. */
function prefixText(prefix: string[], language: Language): string {
  return prefix.length ? prefix.join("/") : say({ language, en: "root ( )"});
}

/** Render one trace event of a closure walk: the base (own node +
 * father's members), the refines entries, a reference search, or a
 * pushed source. */
export function TraceEventRow({ event, language }: { event: any; language: Language }) {
  if (event.kind === "base") {
    return (
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-semibold">① base</span>{" "}
        {say({ language, en: "— own node: "})}
        {event.own ? (
          <span className="font-medium text-emerald-700">
            {say({ language, en: "present"})}
          </span>
        ) : (
          <span className="text-slate-500">{say({ language, en: "absent"})}</span>
        )}
        {event.fatherMembers.length > 0 && (
          <>
            {say({ language, en: " ; father's members: "})}
            <span className="text-slate-500">
              {event.fatherMembers.map((member: any) => addressText(member)).join(" · ")}
            </span>
          </>
        )}
      </div>
    );
  }
  if (event.kind === "entries") {
    if (!event.entries.length) {
      return (
        <div className="text-slate-700 dark:text-slate-200">
          <span className="font-semibold">② refines</span>{" "}
          {say({
            language,
            en: "— none declared in the base: the chain stops at the own node and the father's members.",
          })}
        </div>
      );
    }
    return (
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-semibold">② refines</span>{" "}
        {say({ language, en: "— defined by "})}
        {event.from ? addressText(event.from) : "—"}
        {say({ language, en: ", resolved from the holder "})}
        <span className="text-slate-500">{addressText(event.holder)}</span> :
        <span className="ml-1 text-sky-700">
          {event.entries
            .map((entry: any) =>
              entry.ref ? `→ (${entry.ref[0]}) ${entry.ref[1].join("/")}` : `→ ${entry.lref}`,
            )
            .join(" · ")}
        </span>
      </div>
    );
  }
  if (event.kind === "refsearch") {
    const result = Array.isArray(event.result) ? addressText(event.result) : String(event.result);
    return (
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-semibold text-sky-700">
          {say({ language, en: "⟦resolution⟧"})}
        </span>{" "}
        <span className="text-sky-700">
          → ({event.ref[0]}) {event.ref[1].join("/")}
        </span>{" "}
        {say({ language, en: "from "})}
        {addressText(event.holder)} :
        <div className="ml-3 mt-0.5 space-y-0.5 text-[11px] text-slate-500">
          {event.search.map((searchStep: any, index: number) => (
            <div key={index}>
              {say({ language, en: "prefix "})}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {prefixText(searchStep.prefix, language)}
              </span>{" "}
              {say({ language, en: "→ anchors "})}
              {"{ "}
              {searchStep.anchors.length ? (
                searchStep.anchors.map((anchor: string, anchorIndex: number) => (
                  <span key={anchorIndex}>
                    <span className={anchor === event.ref[0] ? "font-bold text-sky-700" : ""}>
                      {anchor}
                    </span>
                    {anchorIndex < searchStep.anchors.length - 1 ? ", " : ""}
                  </span>
                ))
              ) : (
                <span className="text-slate-600">
                  {say({
                    language,
                    en: "— computing, conservative jump kept",
                  })}
                </span>
              )}
              {" }"} {searchStep.hit ? "✓" : "✗"}
              {searchStep.reroot
                ? say({
                    language,
                    en: " — root anchor: rerooting « " + searchStep.reroot + " »",
                  })
                : ""}
            </div>
          ))}
        </div>
        <div className="ml-3 text-[11px]">
          {say({ language, en: "result: "})}
          <span className="font-medium text-slate-800 dark:text-slate-100">{result}</span>
        </div>
      </div>
    );
  }
  if (event.kind === "push") {
    return (
      <div className="text-slate-700 dark:text-slate-200">
        <span className="font-semibold">③ + source</span>{" "}
        <span className="font-medium">{addressText(event.addr)}</span>{" "}
        <span className="text-slate-600">({labelOf({ code: event.via, language })})</span>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------- status

/** The read statuses of a first-winner scan. */
const STATUS_STYLE: Record<string, string> = {
  fournit: "bg-emerald-50 text-emerald-700 border-emerald-200",
  transparent: "bg-amber-50 text-amber-700 border-amber-200",
  absent: "bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700",
  "non atteint": "bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-100",
};

/** A shape prefix so the status is not conveyed by color alone (WCAG 1.4.1). */
const STATUS_ICON: Record<string, string> = {
  fournit: "● ",
  transparent: "◐ ",
  absent: "○ ",
  "non atteint": "○ ",
};

/** One read status as a pill. */
export function StatusPill({ status, language }: { status: string; language: Language }) {
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[10px] " + (STATUS_STYLE[status] || STATUS_STYLE.absent)
      }
    >
      <span aria-hidden="true">{STATUS_ICON[status] ?? ""}</span>
      {labelOf({ code: status, language })}
    </span>
  );
}
