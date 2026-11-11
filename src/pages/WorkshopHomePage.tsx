// The workshop home: ONE page, two tabs — the atelier (the four
// panels over the corpus) and the graphical model editor. Both routes
// (#workshop, #editor) land here; the hash picks the active tab, so
// the address stays the artifact and the back button works. The tab
// bar only navigates — each tab keeps its own header and its own
// state, exactly as when they were separate pages.

import { lazy, Suspense } from "react";
import { useRouter } from "../components/Router";
import { t } from "../infrastructure/i18n";
import type { Language } from "../domain/messages";

// Each tab is its own chunk: the atelier and the editor never load
// together (issue #90).
const WorkshopPage = lazy(() =>
  import("../WorkshopContainer").then((module) => ({ default: module.WorkshopPage })),
);
const ModelEditorPage = lazy(() =>
  import("../presentation/modelEditorPage").then((module) => ({ default: module.ModelEditorPage })),
);

type WorkshopTab = "workshop" | "editor";

const TABS: readonly WorkshopTab[] = ["workshop", "editor"];

export function WorkshopHomePage({
  tab,
  language,
  onChooseLanguage,
}: {
  tab: WorkshopTab;
  language: Language;
  onChooseLanguage: (language: Language) => void;
}) {
  const { navigate } = useRouter();
  return (
    <div>
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 pt-3">
          {TABS.map((candidate) => (
            <button type="button"
              key={candidate}
              onClick={() => navigate(candidate)}
              aria-current={candidate === tab ? "page" : undefined}
              className={
                candidate === tab
                  ? "rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800"
                  : "rounded-t-lg border border-transparent px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }
            >
              {candidate === "workshop" ? t("the workshop") : t("the graphical model editor")}
            </button>
          ))}
        </div>
      </nav>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center" aria-busy="true">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          </div>
        }
      >
        {tab === "workshop" ? (
          <WorkshopPage language={language} onChooseLanguage={onChooseLanguage} />
        ) : (
          <ModelEditorPage language={language} onChooseLanguage={onChooseLanguage} />
        )}
      </Suspense>
    </div>
  );
}
