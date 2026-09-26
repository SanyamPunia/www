/*
 * The poster under review: a flat composition of geometric shapes on warm
 * paper.
 *
 * It is a drawing rather than a photo so the page fetches nothing, and it is
 * built from separate shapes (discs, a block, a triangle, a half sun, a ring,
 * stripes, a dot grid) so every region a reader marks has one thing in it worth
 * commenting on.
 *
 * The hues are scoped to this experiment. They are the poster's own inks and
 * not tokens, and nothing else may reach for them.
 */

const INK = {
  paper: "#fbf8f3",
  mint: "#5fd6a8",
  peach: "#ff9d6e",
  sky: "#6ab8ff",
  butter: "#ffd447",
  lilac: "#b49bff",
  rose: "#ff8fbf",
  line: "#7fa6ff",
} as const;

/*
 * Bright, light colours at full strength, with room between every shape. A
 * dense poster crowded the boxes and pills drawn over it, and a pastel one
 * read as washed out rather than light.
 */
const DOTS = Array.from({ length: 9 }, (_, i) => ({
  cx: 700 + (i % 3) * 22,
  cy: 62 + Math.floor(i / 3) * 22,
}));

export function Scene() {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="800" height="500" fill={INK.paper} />

      <path d="M0 0 H130 A130 130 0 0 1 0 130 Z" fill={INK.mint} />

      <circle cx="250" cy="270" r="105" fill={INK.peach} />
      <circle cx="372" cy="118" r="38" fill={INK.rose} />

      <rect x="450" y="80" width="150" height="180" fill={INK.sky} />

      <polygon points="720,170 772,270 668,270" fill={INK.lilac} />

      <path d="M510 500 A110 110 0 0 1 730 500 Z" fill={INK.butter} />

      <circle
        cx="420"
        cy="390"
        r="34"
        fill="none"
        stroke={INK.line}
        strokeWidth="8"
      />

      <g fill={INK.line}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="70" y={414 + i * 16} width="150" height="6" rx="3" />
        ))}
      </g>

      <g fill={INK.line}>
        {DOTS.map((d) => (
          <circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r="4" />
        ))}
      </g>
    </svg>
  );
}
