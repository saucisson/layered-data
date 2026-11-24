// The LayeredData logo, in several selectable variants (issue #234).
// Each variant is a small inline SVG mark + the wordmark; the accent
// color follows the theme (emerald in light, lighter in dark).

import type { LogoId } from "../infrastructure/logos.ts";

/** The proposed "L" (LD-9): five stacked isometric slabs, violet at
 *  the top to cyan at the base, over a foot slab stretching right —
 *  the exact construction of public/logos/layered-data-logo-proposition.png,
 *  not a retrace. Same polygons as layered-data-logo-proposition-mark.svg. */
function ProposalMark() {
  const slabs: readonly { cx: number; cy: number; hw: number; color: string }[] = [
    { cx: 24, cy: 12, hw: 20, color: "#8b5cf6" },
    { cx: 24, cy: 23, hw: 20, color: "#7c3aed" },
    { cx: 24, cy: 34, hw: 20, color: "#6366f1" },
    { cx: 24, cy: 45, hw: 20, color: "#3b82f6" },
    { cx: 24, cy: 56, hw: 20, color: "#06b6d4" },
    { cx: 44, cy: 62, hw: 26, color: "#22d3ee" },
  ];
  const h = 10;
  const e = 3;
  return (
    <svg viewBox="0 0 74 76" className="h-6 w-auto" aria-hidden="true">
      {slabs.map((slab) => (
        <g key={`${slab.cx}-${slab.cy}`}>
          <polygon
            points={`${slab.cx},${slab.cy - h} ${slab.cx + slab.hw},${slab.cy} ${slab.cx},${slab.cy + h} ${slab.cx - slab.hw},${slab.cy}`}
            fill={slab.color}
          />
          <polygon
            points={`${slab.cx - slab.hw},${slab.cy} ${slab.cx},${slab.cy + h} ${slab.cx},${slab.cy + h + e} ${slab.cx - slab.hw},${slab.cy + e}`}
            fill={slab.color}
            opacity="0.72"
          />
          <polygon
            points={`${slab.cx},${slab.cy + h} ${slab.cx + slab.hw},${slab.cy} ${slab.cx + slab.hw},${slab.cy + e} ${slab.cx},${slab.cy + h + e}`}
            fill={slab.color}
            opacity="0.55"
          />
        </g>
      ))}
    </svg>
  );
}

function Mark({ variant }: { variant: LogoId }) {
  const accent = "fill-emerald-600 dark:fill-emerald-400";
  const ink = "fill-slate-900 dark:fill-slate-50";
  switch (variant) {
    case "proposal":
      return <ProposalMark />;
    case "stack":
      // three stacked layers, the top one accented
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <rect x="3" y="15" width="18" height="4" rx="1.5" className={ink + " opacity-40"} />
          <rect x="3" y="9.5" width="18" height="4" rx="1.5" className={ink + " opacity-70"} />
          <rect x="3" y="4" width="18" height="4" rx="1.5" className={accent} />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12 2 22 12 12 22 2 12Z" className={ink + " opacity-30"} />
          <path d="M12 6.5 17.5 12 12 17.5 6.5 12Z" className={accent} />
        </svg>
      );
    case "mono":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" className={accent} />
          <text
            x="12"
            y="16.5"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            className="fill-white dark:fill-slate-900"
          >
            LD
          </text>
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M2 15c3-6 5-6 8 0s5 6 8 0"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            className={accent.replace("fill-", "stroke-")}
          />
          <path
            d="M2 9c3-6 5-6 8 0s5 6 8 0"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            className={ink.replace("fill-", "stroke-") + " opacity-40"}
          />
        </svg>
      );
    case "classic":
    default:
      // the wordmark alone carries the accent (Data in emerald)
      return null;
  }
}

export function Logo({ variant }: { variant: LogoId }) {
  if (variant === "artwork") {
    // the provided PNG wordmarks are opaque cards: the light card
    // blends on light themes, the dark card on dark themes
    return (
      <>
        <img
          src="/logos/layered-data-logo-light.png"
          alt="Layered Data"
          className="h-6 w-auto dark:hidden"
        />
        <img
          src="/logos/layered-data-logo-dark.png"
          alt=""
          aria-hidden="true"
          className="hidden h-6 w-auto dark:block"
        />
      </>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Mark variant={variant} />
      <span>
        {variant === "proposal" ? (
          <>
            ayered <span className="font-extrabold">Data</span>
          </>
        ) : (
          <>
            Layered<span className="text-emerald-600 dark:text-emerald-400">Data</span>
          </>
        )}
      </span>
    </span>
  );
}
