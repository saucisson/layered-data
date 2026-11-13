// The status badge of a formalism (issue #144, ADR-0115): draft or
// published, as a small pill next to the formalism name. Every string
// goes through i18next.

import type { FormalismStatus } from "../domain/formalism.ts";
import type { Language } from "../domain/messages.ts";
import { say } from "./i18n.ts";

const STATUS_STYLE: Record<FormalismStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const STATUS_LABEL: Record<FormalismStatus, { en: string }> = {
  draft: { en: "draft" },
  published: { en: "published" },
};

/** The lifecycle status of a formalism as a colored pill. */
export function StatusBadge({
  status,
  language,
}: {
  status: FormalismStatus;
  language: Language;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
        STATUS_STYLE[status]
      }
    >
      {say({ language, en: STATUS_LABEL[status].en })}
    </span>
  );
}
