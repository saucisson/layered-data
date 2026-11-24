// The Layered Data logo: the capitals L and D of the wordmark are
// letterforms cut into five colored strata (violet to orange, top to
// bottom), extruded toward the bottom-right: this is the layered identity
// shared by the three saucisson logos (petrichor, lisage, here). The
// wordmark ink is currentColor, so the single logo follows the light
// and dark themes. The reference exports are served from
// public/logos: layered-data-logo-light.svg, layered-data-logo-dark.svg
// and the emblem-only layered-data-favicon.svg.

const L_PATH =
  "M10 0 H30 V86 Q30 92 36 92 H76 Q84 92 84 100 V110 Q84 120 74 120 H10 Q0 120 0 110 V10 Q0 0 10 0 Z";
const D_PATH =
  "M10 0 H46 C76 0 92 24 92 60 C92 96 76 120 46 120 H10 Q0 120 0 110 V10 Q0 0 10 0 Z";

/** The spectral strata, top to bottom, each with its darker face. */
const STRATA = [
  { color: "#7C5CFF", face: "#5B3FD6" },
  { color: "#2D7DF6", face: "#1E5FC4" },
  { color: "#21C7E3", face: "#178BA3" },
  { color: "#2FBF71", face: "#1F9153" },
  { color: "#FF8A3D", face: "#D6691F" },
] as const;
const STRATUM_HEIGHT = 21.6;
const STRATUM_GAP = 3;
const EXTRUDE_DX = 6;
const EXTRUDE_DY = 4;

/** One capital: the letterform extrusion, then the strata clipped to
 *  the letter, painted bottom-up so each face shades the stratum
 *  below it (SVG paints later elements on top). */
function CapitalLetter({ clipId, letterWidth, path }: { clipId: string; letterWidth: number; path: string }) {
  return (
    <g clipPath={`url(#${clipId})`}>
      <path d={path} fill="#1E293B" transform={`translate(${EXTRUDE_DX},${EXTRUDE_DY})`} />
      {[...STRATA].reverse().map((stratum, index) => {
        const top = (STRATA.length - 1 - index) * (STRATUM_HEIGHT + STRATUM_GAP);
        return (
          <g key={stratum.color}>
            <rect
              x={0}
              y={top + EXTRUDE_DY}
              width={letterWidth + EXTRUDE_DX}
              height={STRATUM_HEIGHT}
              fill={stratum.face}
            />
            <rect x={0} y={top} width={letterWidth} height={STRATUM_HEIGHT} fill={stratum.color} />
          </g>
        );
      })}
    </g>
  );
}

/** The whole wordmark: [L]ayered [D]ata with the two capitals as
 *  strata marks; the lowercase text is set in system-ui like the
 *  exported reference SVGs. */
export function Logo() {
  return (
    <svg viewBox="0 0 700 170" className="h-6 w-auto" role="img" aria-label="Layered Data">
      <defs>
        <clipPath id="logo-l">
          <path d={L_PATH} />
        </clipPath>
        <clipPath id="logo-d">
          <path d={D_PATH} />
        </clipPath>
      </defs>
      <g transform="translate(6,25)">
        <CapitalLetter clipId="logo-l" letterWidth={84} path={L_PATH} />
      </g>
      <text
        x={104}
        y={145}
        fontFamily="system-ui, 'Segoe UI', sans-serif"
        fontSize={92}
        fontWeight={650}
        fill="currentColor"
        letterSpacing={0.5}
      >
        ayered
      </text>
      <g transform="translate(432,25)">
        <CapitalLetter clipId="logo-d" letterWidth={92} path={D_PATH} />
      </g>
      <text
        x={536}
        y={145}
        fontFamily="system-ui, 'Segoe UI', sans-serif"
        fontSize={92}
        fontWeight={650}
        fill="currentColor"
        letterSpacing={0.5}
      >
        ata
      </text>
    </svg>
  );
}
