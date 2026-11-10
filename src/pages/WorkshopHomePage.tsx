// The workshop home: ONE page, two tabs — the atelier (the four
// panels over the corpus) and the graphical model editor. Both routes
// (#workshop, #editor) land here; the hash picks the active tab, so
// the address stays the artifact and the back button works. The tab
// bar only navigates — each tab keeps its own header and its own
// state, exactly as when they were separate pages.

import { useRouter } from "../components/Router";
import { WorkshopPage } from "../WorkshopContainer";
import { ModelEditorPage } from "../presentation/modelEditorPage";
import { t } from "../infrastructure/i18n";
import type { Language } from "../domain/messages";

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
            <button
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
      {tab === "workshop" ? (
        <WorkshopPage language={language} onChooseLanguage={onChooseLanguage} />
      ) : (
        <ModelEditorPage language={language} onChooseLanguage={onChooseLanguage} />
      )}
    </div>
  );
}
