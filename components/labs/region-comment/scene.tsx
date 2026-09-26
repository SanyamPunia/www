/*
 * The poster under review: a coast at dusk, drawn flat.
 *
 * It is a drawing rather than a photo so the page fetches nothing, and it is
 * built from separate objects (sun, ranges, sea, boat, lighthouse, birds) so
 * every region a reader marks has a thing in it worth commenting on.
 *
 * The hues are scoped to this experiment. They are the poster's own inks and
 * not tokens, and nothing else may reach for them.
 */

const INK = {
  skyTop: "#f4e6cf",
  skyMid: "#f3c7a4",
  skyLow: "#eea283",
  halo: "#f6a47c",
  sun: "#ef7b52",
  far: "#c98a7c",
  hills: "#9a5f6e",
  seaTop: "#4a6d8c",
  seaLow: "#2f4a66",
  glint: "#6f8fae",
  glow: "#f3a07c",
  cliff: "#243241",
  paper: "#f5efe6",
  paperShade: "#e6d8c6",
  band: "#c7493f",
  lamp: "#f7d58a",
  beam: "#f7e3a6",
  bird: "#5a3f4a",
  cloud: "#f8eddc",
} as const;

export function Scene() {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="rc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK.skyTop} />
          <stop offset="0.5" stopColor={INK.skyMid} />
          <stop offset="1" stopColor={INK.skyLow} />
        </linearGradient>
        <linearGradient id="rc-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK.seaTop} />
          <stop offset="1" stopColor={INK.seaLow} />
        </linearGradient>
      </defs>

      <rect width="800" height="300" fill="url(#rc-sky)" />

      <g fill={INK.cloud} opacity="0.75">
        <rect x="90" y="92" width="150" height="16" rx="8" />
        <rect x="130" y="76" width="80" height="16" rx="8" />
        <rect x="610" y="60" width="120" height="14" rx="7" />
        <rect x="430" y="118" width="70" height="10" rx="5" />
      </g>

      <circle cx="540" cy="262" r="92" fill={INK.halo} opacity="0.35" />
      <circle cx="540" cy="262" r="58" fill={INK.sun} />

      <path
        d="M0 252 L90 206 L170 236 L262 180 L360 232 L452 202 L540 244 L642 190 L732 228 L800 210 L800 300 L0 300 Z"
        fill={INK.far}
      />
      <path
        d="M0 286 Q120 244 240 272 T480 266 T800 262 L800 300 L0 300 Z"
        fill={INK.hills}
      />

      <rect y="290" width="800" height="210" fill="url(#rc-sea)" />

      <g fill={INK.glow} opacity="0.6">
        <rect x="496" y="300" width="88" height="5" rx="2.5" />
        <rect x="508" y="316" width="64" height="4" rx="2" />
        <rect x="518" y="332" width="44" height="4" rx="2" />
        <rect x="528" y="350" width="24" height="3" rx="1.5" />
      </g>

      <g stroke={INK.glint} strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M630 380 H690" />
        <path d="M430 410 H470" />
        <path d="M660 440 H740" />
        <path d="M250 330 H290" />
      </g>

      <polygon points="78,212 360,160 360,262" fill={INK.beam} opacity="0.3" />

      <g>
        <path d="M330 352 L402 352 L391 365 L341 365 Z" fill={INK.cliff} />
        <path d="M366 352 V288" stroke={INK.cliff} strokeWidth="2.5" />
        <polygon points="368,290 368,348 402,348" fill={INK.paper} />
        <polygon points="364,300 364,348 336,348" fill={INK.paperShade} />
      </g>

      <path
        d="M0 500 L0 330 Q60 316 120 338 Q172 360 204 402 Q236 446 310 500 Z"
        fill={INK.cliff}
      />

      <g>
        <polygon points="56,328 84,328 79,228 61,228" fill={INK.paper} />
        <polygon points="58,300 82,300 81,284 59,284" fill={INK.band} />
        <polygon points="60,262 80,262 80,248 60,248" fill={INK.band} />
        <rect x="56" y="220" width="28" height="8" fill={INK.cliff} />
        <rect x="62" y="204" width="16" height="16" fill={INK.lamp} />
        <polygon points="57,204 83,204 70,189" fill={INK.band} />
      </g>

      <g
        fill="none"
        stroke={INK.bird}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M606 142 q8 -8 16 0 q8 -8 16 0" />
        <path d="M650 118 q6 -6 12 0 q6 -6 12 0" />
        <path d="M580 112 q5 -5 10 0 q5 -5 10 0" />
      </g>
    </svg>
  );
}
