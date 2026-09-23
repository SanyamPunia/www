/*
 * The five things on the strand, drawn rather than fetched.
 *
 * They were five of this site's own lab stills first, cropped hard enough to
 * carry a colour, and that was the weakest thing in the frame: three of the
 * five were screenshots of other experiments reduced to abstraction, and two
 * other labs already put lab stills in a frame. A demo about a strand of
 * objects passing a gate should own its objects.
 *
 * Marbles, because that is what the reference's orbs read as and because a
 * marble is a solved drawing problem: a handful of flat shapes behind glass,
 * legible at 27px and at 69px, with the kind saying as much as the colour.
 * Five kinds and no two built from the same parts, which is what makes them an
 * assortment rather than a palette.
 *
 * Each draws its interior only, in a 100 unit box that the ball clips to a
 * circle. The light on top of them is one shared pass in `index.tsx`, since
 * there is one lamp over the stage and not five.
 *
 * The hues are the twenty-fourth scoped set in the lab and make the same claim as
 * the others: colour is what tells five objects apart. `mark` is the one the
 * readout puts beside each name, and it is the ball's own dominant tone. They
 * are not tokens and nothing outside this experiment may reach for them.
 */

export interface Marble {
  name: string;
  /** the ball's dominant tone, which the panel's readout prints beside it */
  mark: string;
  Art: () => React.ReactElement;
}

/** a corkscrew: two canes wound through a cobalt body */
const Corkscrew = () => (
  <>
    <rect width="100" height="100" fill="#1c3f8f" />
    <path
      d="M-6 26 C 18 4, 54 48, 106 16 L106 38 C 54 70, 18 26, -6 48 Z"
      fill="#f2e6cf"
    />
    <path
      d="M-6 62 C 20 42, 52 86, 106 56 L106 74 C 52 104, 20 60, -6 84 Z"
      fill="#e8a33d"
    />
  </>
);

/** an oxblood: one deep red body with a band laid across it */
const Oxblood = () => (
  <>
    <rect width="100" height="100" fill="#a83a2a" />
    <g transform="rotate(-20 50 50)">
      <rect x="-25" y="36" width="150" height="28" fill="#f4ece0" />
      <rect x="-25" y="45" width="150" height="8" fill="#d99a3c" />
    </g>
  </>
);

/** a clearie: a violet pour with the air still in it */
const Clearie = () => (
  <>
    <rect width="100" height="100" fill="#6b4fb3" />
    <circle cx="36" cy="60" r="11" fill="#ffffff" opacity="0.45" />
    <circle cx="63" cy="38" r="7" fill="#ffffff" opacity="0.38" />
    <circle cx="60" cy="70" r="4.5" fill="#ffffff" opacity="0.32" />
    <circle cx="30" cy="34" r="3.5" fill="#ffffff" opacity="0.3" />
  </>
);

/** a cat's eye: one folded vane standing in the middle of the glass */
const CatsEye = () => (
  <>
    <rect width="100" height="100" fill="#157a55" />
    <g transform="rotate(-14 50 50)">
      <path
        d="M50 2 C 70 26, 70 74, 50 98 C 30 74, 30 26, 50 2 Z"
        fill="#f4ece0"
      />
      <path
        d="M50 16 C 61 32, 61 68, 50 84 C 39 68, 39 32, 50 16 Z"
        fill="#cfe4d8"
      />
    </g>
  </>
);

/** an aggie: banded stone, its rings off centre the way a cut one is */
const Aggie = () => (
  <>
    <circle cx="50" cy="50" r="50" fill="#b4761f" />
    <circle cx="45" cy="45" r="39" fill="#e8c069" />
    <circle cx="48" cy="48" r="26" fill="#8a3f1b" />
    <circle cx="51" cy="51" r="13" fill="#f0dca8" />
  </>
);

export const MARBLE = {
  corkscrew: { name: "Corkscrew", mark: "#1c3f8f", Art: Corkscrew },
  oxblood: { name: "Oxblood", mark: "#a83a2a", Art: Oxblood },
  clearie: { name: "Clearie", mark: "#6b4fb3", Art: Clearie },
  catseye: { name: "Cat's Eye", mark: "#157a55", Art: CatsEye },
  aggie: { name: "Aggie", mark: "#b4761f", Art: Aggie },
} as const satisfies Record<string, Marble>;

export type MarbleKey = keyof typeof MARBLE;
