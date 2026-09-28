/**
 * The five photos in the pile, drawn rather than fetched.
 *
 * The page makes no request for a picture it did not draw, which is what
 * `/privacy` promises, so each is a flat illustration of a place written as an
 * SVG string. They are photos in the sense the demo needs: each has one
 * obvious subject and a dominant tone, so a card that is mostly hidden behind
 * another still says which picture it is from the sliver that shows.
 *
 * No filters. A card resizes on every frame of an open and a close, and an
 * `<img>` holding an SVG is rasterised again at each new size, so a blur or a
 * turbulence in here would be paid for sixty times a second.
 *
 * The hues are scoped to this experiment. They are the pictures, not tokens.
 */

/** every photo's own box, in its own units, a 4:5 portrait */
export const PHOTO_W = 400;
export const PHOTO_H = 500;

/**
 * A fixed wobble per detail, so every load draws the same windows and books.
 * An integer hash, for `stem-picker`'s reason.
 */
function seed(index: number, salt: number): number {
  let hash = Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PHOTO_W} ${PHOTO_H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

const sky = (id: string, stops: readonly [number, string][]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([at, color]) => `<stop offset="${at}" stop-color="${color}"/>`)
    .join("")}</linearGradient>`;

/** the reference's own picture: sea past a cliff, over a stone balustrade */
function coast(): string {
  const arches = Array.from({ length: 7 }, (_, i) => {
    const x = 26 + i * 52;
    return `<path d="M${x} 470V428a12 12 0 0 1 24 0V470Z" fill="#eef0ec"/>`;
  }).join("");
  return svg(
    `<defs>${sky("s", [
      [0, "#9cc4e4"],
      [0.5, "#d7e7f0"],
    ])}${sky("w", [
      [0, "#3f7fb8"],
      [1, "#2a5e93"],
    ])}</defs>
    <rect width="400" height="500" fill="url(#s)"/>
    <rect y="190" width="400" height="200" fill="url(#w)"/>
    <path d="M0 110C40 96 70 120 104 128S160 176 196 214 250 262 262 300 250 360 230 390H0Z" fill="#35506b"/>
    <path d="M0 170C36 164 70 186 100 206S150 262 170 300 176 360 160 390H0Z" fill="#26394d"/>
    <path d="M300 250h100v6H300Z" fill="#8fb6d8" opacity=".6"/>
    <path d="M250 300h150v4H250Z" fill="#8fb6d8" opacity=".5"/>
    <rect y="372" width="400" height="16" fill="#e7e6df"/>
    <rect y="388" width="400" height="112" fill="#34302d"/>
    ${arches}
    <rect y="470" width="400" height="30" fill="#2a2724"/>`,
  );
}

/** a sun going down behind a sea of dunes */
function dunes(): string {
  return svg(
    `<defs>${sky("s", [
      [0, "#6b5fa8"],
      [0.45, "#e98d7b"],
      [0.62, "#f6c27a"],
    ])}</defs>
    <rect width="400" height="500" fill="url(#s)"/>
    <circle cx="258" cy="268" r="46" fill="#fde2a4"/>
    <path d="M0 300C70 272 130 290 190 306S320 280 400 292V500H0Z" fill="#d98a52"/>
    <path d="M0 356C90 318 170 330 230 350S340 330 400 340V500H0Z" fill="#c26d3c"/>
    <path d="M230 350C280 372 330 400 400 410V500H200C230 440 250 400 230 350Z" fill="#9c4f2b"/>
    <path d="M0 430C80 398 160 404 220 424S340 440 400 430V500H0Z" fill="#b25e33"/>
    <path d="M0 430C60 440 110 470 130 500H0Z" fill="#7f3d22"/>`,
  );
}

/** towers at night, their windows lit at random */
function city(): string {
  const towers = [
    [0, 250, 58],
    [52, 180, 64],
    [112, 280, 44],
    [150, 140, 70],
    [216, 230, 52],
    [264, 170, 66],
    [326, 260, 74],
  ];
  const lit = towers
    .flatMap(([x, top, w], t) => {
      const cells: string[] = [];
      for (let row = 0; top + 16 + row * 18 < 480; row++) {
        for (let col = 0; col * 14 + 20 < w; col++) {
          if (seed(t * 97 + row * 13 + col, 3) > 0.42) continue;
          cells.push(
            `<rect x="${x + 8 + col * 14}" y="${top + 14 + row * 18}" width="7" height="9" fill="${seed(row, t + col) > 0.3 ? "#f7d58b" : "#9fd0f0"}"/>`,
          );
        }
      }
      return cells;
    })
    .join("");
  return svg(
    `<defs>${sky("s", [
      [0, "#0e1733"],
      [0.7, "#3a2a5c"],
      [1, "#6b3d6e"],
    ])}</defs>
    <rect width="400" height="500" fill="url(#s)"/>
    <circle cx="320" cy="84" r="26" fill="#f1ead2"/>
    ${towers
      .map(
        ([x, top, w], t) =>
          `<rect x="${x}" y="${top}" width="${w}" height="${500 - top}" fill="${t % 2 ? "#161a2e" : "#1f2440"}"/>`,
      )
      .join("")}
    ${lit}
    <rect y="480" width="400" height="20" fill="#0b0d18"/>`,
  );
}

/** snow on the peaks, a line of pines, and the lake holding both */
function lake(): string {
  const pines = Array.from({ length: 16 }, (_, i) => {
    const x = i * 26 - 6 + seed(i, 5) * 10;
    const h = 46 + seed(i, 6) * 40;
    return `<path d="M${x} 300L${x + 14} ${300 - h}L${x + 28} 300Z" fill="#1f3d34"/>`;
  }).join("");
  return svg(
    `<defs>${sky("s", [
      [0, "#7fb2d9"],
      [0.6, "#dcebf3"],
    ])}${sky("l", [
      [0, "#4f8aa6"],
      [1, "#1f4a5e"],
    ])}</defs>
    <rect width="400" height="500" fill="url(#s)"/>
    <path d="M0 250L96 110L160 196L236 70L330 200L400 150V300H0Z" fill="#6c7f93"/>
    <path d="M96 110L118 142L104 136L86 150Z M236 70L266 112L246 104L226 122L214 102Z M400 150V176L382 170L366 182Z" fill="#f5f7f8"/>
    <path d="M0 280L60 232L130 270L200 226L280 262L340 236L400 262V300H0Z" fill="#4c6275"/>
    ${pines}
    <rect y="300" width="400" height="200" fill="url(#l)"/>
    <g opacity=".28" transform="translate(0 600) scale(1 -1)">${pines}</g>
    <path d="M40 360h120v3H40Z M220 400h140v3H220Z M90 450h90v3H90Z" fill="#cfe4ee" opacity=".55"/>`,
  );
}

/** a reading room: a tall window, a column, shelves and lamps */
function library(): string {
  const books = Array.from({ length: 3 }, (_, shelf) => {
    const y = 300 + shelf * 58;
    let x = 238;
    const spines: string[] = [];
    let i = 0;
    while (x < 392) {
      const w = 6 + Math.floor(seed(i, shelf) * 7);
      const h = 34 + Math.floor(seed(i, shelf + 4) * 14);
      const hue = ["#8b3a2f", "#2f4e6f", "#6f6a3a", "#c9b58a", "#4a3b5c"][
        Math.floor(seed(i, shelf + 9) * 5)
      ];
      spines.push(
        `<rect x="${x}" y="${y + 48 - h}" width="${w}" height="${h}" fill="${hue}"/>`,
      );
      x += w + 1;
      i++;
    }
    return `${spines.join("")}<rect x="232" y="${y + 48}" width="168" height="5" fill="#6b4a33"/>`;
  }).join("");
  const panes = Array.from({ length: 24 }, (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return `<rect x="${40 + col * 36}" y="${60 + row * 50}" width="32" height="46" fill="${seed(i, 1) > 0.5 ? "#7fa9cf" : "#9cc0dd"}"/>`;
  }).join("");
  return svg(
    `<rect width="400" height="500" fill="#ece6da"/>
    <rect x="32" y="52" width="152" height="310" fill="#3b3a38"/>
    ${panes}
    <rect x="196" y="0" width="30" height="500" fill="#2b2826"/>
    <rect x="232" y="280" width="168" height="200" fill="#d8ccb6"/>
    ${books}
    <path d="M70 40h60l-8 20H78Z M270 30h70l-9 22h-52Z" fill="#fbf6ea"/>
    <rect x="0" y="420" width="400" height="80" fill="#8a6a4a"/>
    <rect x="40" y="400" width="170" height="12" fill="#5e412b"/>
    <path d="M70 400v-30h24v30Z M150 400v-24h20v24Z" fill="#f6efd8"/>
    <circle cx="112" cy="386" r="14" fill="#4a5a8a"/>
    <rect x="98" y="398" width="28" height="30" fill="#4a5a8a"/>`,
  );
}

export interface Photo {
  id: string;
  /** the alt text and the caption, in sentence case */
  title: string;
  uri: string;
}

const uri = (markup: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.replace(/\s+/g, " "))}`;

export const PHOTOS: readonly Photo[] = [
  { id: "coast", title: "The coast road", uri: uri(coast()) },
  { id: "library", title: "Reading room", uri: uri(library()) },
  { id: "dunes", title: "Dunes at dusk", uri: uri(dunes()) },
  { id: "city", title: "Late windows", uri: uri(city()) },
  { id: "lake", title: "Alpine lake", uri: uri(lake()) },
];
