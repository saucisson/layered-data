// The workshop header: the search (Ctrl+K from anywhere), the guided
// tour S1–S14 folded in, and the active scenario's banner. Pure
// presentation — the state lives in the composition root.

import { WORKSHOP_SCENARIOS, type WorkshopScenario } from "../scenarios.ts";
import { localized, say } from "../i18n.ts";
import type { Language } from "../../domain/messages.ts";

export function WorkshopHeader({
  language,
  search,
  onSearchChange,
  onSubmitSearch,
  guidedTourOpen,
  onToggleGuidedTour,
  scenarioIndex,
  onActivateScenario,
  activeScenario,
  onCloseScenario,
}: {
  language: Language;
  search: string;
  onSearchChange: (search: string) => void;
  onSubmitSearch: () => void;
  guidedTourOpen: boolean;
  onToggleGuidedTour: () => void;
  scenarioIndex: number;
  onActivateScenario: (index: number) => void;
  activeScenario: WorkshopScenario | null;
  onCloseScenario: () => void;
}) {
  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold">
            {say({
              language,
              en: "The formalism design workshop — Layered Data",
            })}
          </h1>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {say({
            language,
            en: "Formalism design workshop — Layered Data, refinement, first-wins reading",
          })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="workshop-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event: any) => {
              if (event.key === "Enter") onSubmitSearch();
              if (event.key === "Escape") onSearchChange("");
            }}
            placeholder={say({
              language,
              en: "Search — layer, or key of the current address; " + "Enter: go there · Ctrl+K",
            })}
            className="min-w-0 flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none sm:min-w-[240px]"
          />
          <button type="button"
            onClick={onToggleGuidedTour}
            aria-expanded={guidedTourOpen}
            title={say({
              language,
              en: "the S1–S14 scenarios: the workshop's guided curriculum",
            })}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (guidedTourOpen
                ? "border-slate-800 dark:border-slate-600 bg-slate-800 dark:bg-slate-600 text-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-500 dark:hover:border-slate-400")
            }
          >
            {say({ language, en: "Guided tour S1–S14" })}{" "}
            {guidedTourOpen ? "▾" : "▸"}
          </button>
        </div>
        {guidedTourOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {WORKSHOP_SCENARIOS.map((scenario, index) => (
              <button type="button"
                key={scenario.id}
                onClick={() => onActivateScenario(index)}
                title={localized({ language, text: scenario.text })}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (scenarioIndex === index
                    ? "border-slate-800 dark:border-slate-600 bg-slate-800 dark:bg-slate-600 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-500 dark:hover:border-slate-400")
                }
              >
                {scenario.id} · {localized({ language, text: scenario.label })}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* The tutorial at the top: the workshop is learned before
              it is used — the addresses of the stratigraphic column navigate the
              space like the rest of the tool (goto: the address is
              the artifact) */}

      {activeScenario && (
        <div className="mx-2 mt-3 sm:mx-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm leading-6 text-slate-700 dark:text-slate-200 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-800 dark:bg-slate-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {activeScenario.id}
            </span>
            <span className="font-semibold">
              {localized({ language, text: activeScenario.label })}
            </span>
            <button type="button"
              className="ml-auto rounded px-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-200"
              onClick={onCloseScenario}
              aria-label={say({ language, en: "close the scenario" })}
            >
              ×
            </button>
          </div>
          {localized({ language, text: activeScenario.text })}
        </div>
      )}
    </>
  );
}
