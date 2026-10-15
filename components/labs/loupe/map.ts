/*
 * The print under the glass: a harbour town drawn onto a canvas, once, at
 * several times the stage's own density.
 *
 * Everything on it is drawn rather than fetched, since `/privacy` promises no
 * image from another origin. The map is laid out in a 538 by 336 design space
 * and scaled to cover the stage, so a phone's taller stage crops a little off
 * the sides. The furniture that belongs to the sheet's edge (the border, the
 * compass, the scale bar and the title) is placed off the visible rect instead,
 * so a crop never cuts it.
 *
 * The print is set at three sizes on purpose. District names read at 1x. Street
 * names, soundings and the title's small print are 2.2 to 3 units, which is a
 * smudge at 1x and readable at about 2.5x. The border is microprint, a line of
 * 1.7 unit type that only the glass at full height resolves, the way the
 * microprint on a banknote does.
 *
 * Nothing rolls at runtime. Every scattered thing is a hash of its index, so
 * the same town is printed on every visit.
 */

export const DESIGN = { w: 538, h: 336 } as const;

/** the print's inks, scoped to this experiment and not tokens */
export const INK = {
  sea: "#d4e3e5",
  seaLine: "#a6c1c7",
  sounding: "#5f7d86",
  seaName: "#7f9ea7",
  land: "#f1e8d4",
  block: "#e7d8b9",
  building: "#dac7a1",
  buildingEdge: "#c2aa7e",
  road: "#fcf8ef",
  roadEdge: "#cbba96",
  avenue: "#f3e1b3",
  avenueEdge: "#cba769",
  park: "#d0deb1",
  parkEdge: "#a6bb82",
  tree: "#94ad70",
  treeLight: "#b3c991",
  river: "#bfd6dc",
  riverEdge: "#8fb0b9",
  rail: "#4f463a",
  text: "#382f24",
  soft: "#776850",
  red: "#b2412d",
  paper: "#f6efdf",
} as const;

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** where the sea ends, in design units, for any row */
function coast(y: number): number {
  return (
    150 + y * 0.27 + 17 * Math.sin(y * 0.031 + 1) + 6 * Math.sin(y * 0.093 + 2)
  );
}

/** the street grid: a centre, a turn and a pitch */
const GRID = { x: 380, y: 170, turn: -0.24, pitch: 22 } as const;
/** every third line of the grid is an avenue */
const AVENUE = 3;
/** the park, as grid cells */
const PARK = { i0: 1, i1: 3, j0: -3, j1: -1 } as const;

/** the river's course, top to sea */
const RIVER: readonly (readonly [number, number])[] = [
  [396, -12],
  [374, 36],
  [388, 84],
  [354, 132],
  [322, 178],
  [284, 212],
  [236, 236],
  [196, 252],
];

/** the town's streets, by grid line, in reading order */
const STREETS = [
  "ferry lane",
  "salt street",
  "rope walk",
  "chandler row",
  "lamp street",
  "tide lane",
  "net street",
  "anchor row",
  "cooper lane",
  "mill street",
];
const AVENUES = ["harbour avenue", "lantern way", "quay road", "bell avenue"];

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, family: string, size: number, opts = "500"): void {
  ctx.font = `${opts} ${size}px ${family}`;
}

/** a world point for a grid point, in design units */
function grid(i: number, j: number): [number, number] {
  const c = Math.cos(GRID.turn);
  const s = Math.sin(GRID.turn);
  const x = i * GRID.pitch;
  const y = j * GRID.pitch;
  return [GRID.x + x * c - y * s, GRID.y + x * s + y * c];
}

function smoothPath(ctx: Ctx, pts: readonly (readonly [number, number])[]) {
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    if (!p || !q) continue;
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  const last = pts[pts.length - 1];
  if (last) ctx.lineTo(last[0], last[1]);
}

/** text with a halo in the ground it sits on, so it reads over roads */
function label(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  {
    angle = 0,
    color = INK.text,
    halo = INK.land,
    width = 0.9,
  }: { angle?: number; color?: string; halo?: string | null; width?: number },
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (halo) {
    ctx.lineJoin = "round";
    ctx.lineWidth = width;
    ctx.strokeStyle = halo;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Draw the whole sheet onto `ctx`, whose canvas is `cw` by `ch` pixels and
 * covers the stage. `family` is the page's own font stack.
 */
export function drawMap(
  ctx: Ctx,
  cw: number,
  ch: number,
  family: string,
): void {
  const s = Math.max(cw / DESIGN.w, ch / DESIGN.h);
  const ox = (cw - DESIGN.w * s) / 2;
  const oy = (ch - DESIGN.h * s) / 2;
  // the part of the design space the stage actually shows
  const v = {
    x0: -ox / s,
    y0: -oy / s,
    x1: (cw - ox) / s,
    y1: (ch - oy) / s,
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK.sea;
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const top = v.y0 - 20;
  const bottom = v.y1 + 20;
  const coastline: [number, number][] = [];
  for (let y = top; y <= bottom; y += 3) coastline.push([coast(y), y]);

  // depth contours, further out and fainter, dashed past the shelf
  [9, 20, 34, 52, 75, 102].forEach((off, k) => {
    ctx.beginPath();
    coastline.forEach(([x, y], n) => {
      const wob = 2.2 * Math.sin(y * 0.05 + k * 1.7);
      if (n === 0) ctx.moveTo(x - off + wob, y);
      else ctx.lineTo(x - off + wob, y);
    });
    ctx.strokeStyle = INK.seaLine;
    ctx.globalAlpha = 1 - k * 0.1;
    ctx.lineWidth = 0.32;
    ctx.setLineDash(k < 2 ? [] : [1.6, 1.1]);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // the title block sits in the sea, so soundings keep out of it
  const card = { x: v.x0 + 14, y: v.y1 - 70, w: 150, h: 56 };
  const inCard = (x: number, y: number) =>
    x > card.x - 6 &&
    x < card.x + card.w + 6 &&
    y > card.y - 6 &&
    y < card.y + card.h + 6;

  // the sea's own labels keep the soundings off them too
  const quiet = [
    { x: 28, y: 108, w: 94, h: 26 },
    { x: coast(150) - 48, y: 139, w: 52, h: 14 },
    { x: coast(262) - 34, y: 251, w: 38, h: 14 },
  ];
  const inLabel = (x: number, y: number) =>
    quiet.some((q) => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);

  // soundings, deeper further from the shore
  font(ctx, family, 2.6, "italic 500");
  for (let n = 0; n < 160; n++) {
    const y = v.y0 + 12 + hash(n * 3 + 1) * (v.y1 - v.y0 - 24);
    const shore = coast(y);
    const x = v.x0 + 12 + hash(n * 3 + 2) * (shore - v.x0 - 20);
    if (x > shore - 7 || inCard(x, y) || inLabel(x, y)) continue;
    const depth = Math.round(2 + (shore - x) * 0.22 + hash(n * 3 + 3) * 3);
    label(ctx, String(depth), x, y, { color: INK.sounding, halo: null });
  }

  // the sea's name, spaced out across open water
  font(ctx, family, 8, "italic 400");
  ctx.letterSpacing = "3px";
  label(ctx, "the sound", 74, 118, {
    color: INK.seaName,
    halo: null,
    angle: 0.08,
  });
  ctx.letterSpacing = "0px";
  font(ctx, family, 2.4, "italic 500");
  label(ctx, "soundings in fathoms", 74, 128, {
    color: INK.sounding,
    halo: null,
    angle: 0.08,
  });

  // land
  ctx.beginPath();
  coastline.forEach(([x, y], n) => {
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(v.x1 + 20, bottom);
  ctx.lineTo(v.x1 + 20, top);
  ctx.closePath();
  ctx.fillStyle = INK.land;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // blocks are the ground, buildings sit on them, roads cut between
  ctx.fillStyle = INK.block;
  ctx.fillRect(v.x0 - 20, top, v.x1 - v.x0 + 40, bottom - top);

  const span = 16;
  const c = Math.cos(GRID.turn);
  const sn = Math.sin(GRID.turn);
  const inPark = (i: number, j: number) =>
    i >= PARK.i0 && i < PARK.i1 && j >= PARK.j0 && j < PARK.j1;

  ctx.save();
  ctx.setTransform(
    s * c,
    s * sn,
    -s * sn,
    s * c,
    ox + GRID.x * s,
    oy + GRID.y * s,
  );
  const P = GRID.pitch;
  for (let i = -span; i < span; i++) {
    for (let j = -span; j < span; j++) {
      if (inPark(i, j)) continue;
      const seed = (i + 40) * 131 + (j + 40) * 7;
      // a few cells are yards and squares, which is what makes the rest read
      // as buildings rather than as a tiling
      if (hash(seed) < 0.08) continue;
      const cols = hash(seed + 1) < 0.5 ? 2 : 3;
      const rows = 2;
      const x0 = i * P + 2.2;
      const y0 = j * P + 2.2;
      const inner = P - 4.4;
      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < rows; b++) {
          const k = seed * 13 + a * 3 + b;
          if (hash(k) < 0.12) continue;
          const bw = inner / cols;
          const bh = inner / rows;
          const ix = hash(k + 1) * 0.9;
          const iy = hash(k + 2) * 0.9;
          const x = x0 + a * bw + 0.35 + ix * 0.4;
          const y = y0 + b * bh + 0.35 + iy * 0.4;
          const w = bw - 0.7 - hash(k + 3) * 1.6;
          const h = bh - 0.7 - hash(k + 4) * 1.6;
          ctx.fillStyle = INK.building;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = INK.buildingEdge;
          ctx.lineWidth = 0.18;
          ctx.strokeRect(x, y, w, h);
          // a house number on a few, the smallest type on the land
          if (hash(k + 5) < 0.18) {
            font(ctx, family, 1.5, "600");
            ctx.fillStyle = INK.soft;
            ctx.fillText(
              String(1 + Math.floor(hash(k + 6) * 98)),
              x + w / 2,
              y + h / 2,
            );
          }
        }
      }
    }
  }

  // the park, with its pond, paths and trees
  const px = PARK.i0 * P + 1.4;
  const py = PARK.j0 * P + 1.4;
  const pw = (PARK.i1 - PARK.i0) * P - 2.8;
  const ph = (PARK.j1 - PARK.j0) * P - 2.8;
  ctx.fillStyle = INK.park;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = INK.parkEdge;
  ctx.lineWidth = 0.35;
  ctx.strokeRect(px, py, pw, ph);
  ctx.beginPath();
  ctx.moveTo(px, py + ph * 0.7);
  ctx.bezierCurveTo(
    px + pw * 0.3,
    py + ph * 0.4,
    px + pw * 0.6,
    py + ph * 0.95,
    px + pw,
    py + ph * 0.35,
  );
  ctx.moveTo(px + pw * 0.35, py);
  ctx.quadraticCurveTo(px + pw * 0.45, py + ph * 0.5, px + pw * 0.3, py + ph);
  ctx.strokeStyle = INK.road;
  ctx.lineWidth = 0.7;
  ctx.setLineDash([1.2, 0.8]);
  ctx.stroke();
  ctx.setLineDash([]);
  const pond = { x: px + pw * 0.68, y: py + ph * 0.62, rx: 6.4, ry: 3.8 };
  ctx.beginPath();
  ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = INK.river;
  ctx.fill();
  ctx.strokeStyle = INK.riverEdge;
  ctx.lineWidth = 0.25;
  ctx.stroke();
  for (let n = 0; n < 70; n++) {
    const tx = px + 1.6 + hash(n * 5 + 900) * (pw - 3.2);
    const ty = py + 1.6 + hash(n * 5 + 901) * (ph - 3.2);
    const dx = (tx - pond.x) / (pond.rx + 1.6);
    const dy = (ty - pond.y) / (pond.ry + 1.6);
    if (dx * dx + dy * dy < 1) continue;
    const r = 0.7 + hash(n * 5 + 902) * 0.9;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fillStyle = INK.tree;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx - r * 0.3, ty - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = INK.treeLight;
    ctx.fill();
  }
  // two easter eggs in the park, small enough that only the glass finds them
  font(ctx, family, 1.3, "italic 500");
  ctx.fillStyle = INK.sounding;
  ctx.fillText("no fishing", pond.x, pond.y + 0.2);
  font(ctx, family, 2.6, "600");
  ctx.letterSpacing = "0.4px";
  label(ctx, "lumen gardens", px + pw * 0.34, py + ph * 0.2, {
    color: INK.soft,
    halo: INK.park,
    width: 0.8,
  });
  ctx.letterSpacing = "0px";

  // minor streets, cased
  const drawLines = (avenue: boolean) => {
    for (const pass of [0, 1]) {
      ctx.beginPath();
      for (let n = -span; n <= span; n++) {
        if ((n % AVENUE === 0) !== avenue) continue;
        ctx.moveTo(n * P, -span * P);
        ctx.lineTo(n * P, span * P);
        ctx.moveTo(-span * P, n * P);
        ctx.lineTo(span * P, n * P);
      }
      ctx.lineCap = "butt";
      if (avenue) {
        ctx.strokeStyle = pass === 0 ? INK.avenueEdge : INK.avenue;
        ctx.lineWidth = pass === 0 ? 4.2 : 3.4;
      } else {
        ctx.strokeStyle = pass === 0 ? INK.roadEdge : INK.road;
        ctx.lineWidth = pass === 0 ? 2.3 : 1.7;
      }
      ctx.stroke();
    }
  };
  drawLines(false);
  ctx.restore();

  // the river, under the avenues so they cross it as bridges
  ctx.save();
  smoothPath(ctx, RIVER);
  ctx.strokeStyle = INK.riverEdge;
  ctx.lineWidth = 10.4;
  ctx.stroke();
  ctx.strokeStyle = INK.river;
  ctx.lineWidth = 9.4;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.setTransform(
    s * c,
    s * sn,
    -s * sn,
    s * c,
    ox + GRID.x * s,
    oy + GRID.y * s,
  );
  drawLines(true);
  ctx.restore();

  // the harbour line, a rail track along the shore
  const rail: [number, number][] = [];
  for (let y = top; y <= bottom; y += 3) rail.push([coast(y) + 15, y]);
  ctx.beginPath();
  rail.forEach(([x, y], n) => {
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineCap = "butt";
  ctx.strokeStyle = INK.rail;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.strokeStyle = INK.land;
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2.4, 2.4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // the shore's own edge
  ctx.beginPath();
  coastline.forEach(([x, y], n) => {
    if (n === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = INK.riverEdge;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // two piers into the sound
  for (const [y, len] of [
    [150, 44],
    [262, 30],
  ] as const) {
    const x = coast(y);
    ctx.fillStyle = INK.land;
    ctx.strokeStyle = INK.roadEdge;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.rect(x - len, y - 2.2, len + 3, 4.4);
    ctx.fill();
    ctx.stroke();
  }
  font(ctx, family, 2.4, "600");
  label(ctx, "pier three", coast(150) - 24, 145.4, {
    color: INK.soft,
    halo: INK.sea,
  });
  label(ctx, "ferry steps", coast(262) - 16, 257.4, {
    color: INK.soft,
    halo: INK.sea,
  });

  // the lighthouse, on the point
  const lh = { x: coast(28) - 2, y: 28 };
  ctx.save();
  ctx.translate(lh.x, lh.y);
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 2.6, Math.sin(a) * 2.6);
    ctx.lineTo(Math.cos(a) * 5.2, Math.sin(a) * 5.2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 1.7, 0, Math.PI * 2);
  ctx.fillStyle = INK.red;
  ctx.fill();
  ctx.restore();
  font(ctx, family, 2.6, "600");
  ctx.textAlign = "left";
  label(ctx, "lumen light", lh.x + 7, lh.y + 0.4, {
    color: INK.red,
    halo: INK.land,
  });
  font(ctx, family, 1.7, "italic 500");
  label(ctx, "fl. white every 10 seconds", lh.x + 7, lh.y + 3.6, {
    color: INK.soft,
    halo: INK.land,
  });
  ctx.textAlign = "center";

  // the station on the harbour line
  const st = { x: coast(204) + 15, y: 204 };
  ctx.fillStyle = INK.red;
  ctx.fillRect(st.x - 2.2, st.y - 1.4, 4.4, 2.8);
  ctx.textAlign = "left";
  font(ctx, family, 2.6, "600");
  label(ctx, "lumen central", st.x + 4.4, st.y + 0.2, { color: INK.text });
  font(ctx, family, 1.7, "italic 500");
  label(ctx, "harbour line", st.x + 4.4, st.y + 3.2, { color: INK.soft });
  ctx.textAlign = "center";

  // street names, along the minor streets
  font(ctx, family, 2.2, "500");
  const across = [-6, -4, -2, 1, 2, 4, 5, 7, 8, 10];
  across.forEach((n, k) => {
    const name = STREETS[k % STREETS.length] ?? "";
    const along = -1.5 + ((k * 2.7) % 4) - 1;
    const [x, y] = grid(n, along);
    if (x < coast(y) + 22) return;
    label(ctx, name, x, y, {
      angle: GRID.turn + Math.PI / 2,
      color: INK.soft,
      halo: INK.road,
      width: 0.6,
    });
  });
  [-4, -1, 2, 5].forEach((n, k) => {
    const name = STREETS[(k + 4) % STREETS.length] ?? "";
    const [x, y] = grid(0.5 + k * 1.3, n);
    if (x < coast(y) + 22) return;
    label(ctx, name, x, y, {
      angle: GRID.turn,
      color: INK.soft,
      halo: INK.road,
      width: 0.6,
    });
  });
  font(ctx, family, 2.6, "600");
  [-3, 0, 3, 6].forEach((n, k) => {
    const name = AVENUES[k] ?? "";
    const [x, y] = grid(n, -0.5 + k * 0.6);
    if (x < coast(y) + 26) return;
    label(ctx, name, x, y, {
      angle: GRID.turn + Math.PI / 2,
      color: INK.text,
      halo: INK.avenue,
      width: 0.7,
    });
  });

  // the river's name, along its own reach
  font(ctx, family, 3.2, "italic 500");
  ctx.letterSpacing = "0.6px";
  label(ctx, "the lantern", 371, 108, {
    angle: -0.95,
    color: INK.sounding,
    halo: INK.river,
    width: 0.6,
  });
  ctx.letterSpacing = "0px";

  // districts, the only type that reads without the glass
  font(ctx, family, 6, "600");
  ctx.letterSpacing = "1.6px";
  for (const [name, x, y] of [
    ["old town", 460, 152],
    ["the docks", 300, 286],
    ["north quay", 270, 40],
    ["riverside", 446, 262],
  ] as const) {
    ctx.globalAlpha = 0.72;
    label(ctx, name, x, y, { color: INK.soft, halo: null });
  }
  ctx.globalAlpha = 1;
  ctx.letterSpacing = "0px";

  // the easter egg: where the glass rests, a note to whoever is holding it
  const here = { x: 404, y: 136 };
  ctx.strokeStyle = INK.red;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(here.x - 1, here.y - 1);
  ctx.lineTo(here.x + 1, here.y + 1);
  ctx.moveTo(here.x + 1, here.y - 1);
  ctx.lineTo(here.x - 1, here.y + 1);
  ctx.stroke();
  font(ctx, family, 1.6, "italic 600");
  ctx.textAlign = "left";
  label(ctx, "you are here, reading this", here.x + 2, here.y + 0.1, {
    color: INK.red,
    halo: INK.block,
    width: 0.5,
  });
  ctx.textAlign = "center";

  drawFurniture(ctx, family, v, card);
}

/**
 * The sheet's edge: the title block, the compass, the scale bar, and the
 * border, whose inner rule is a line of microprint.
 */
function drawFurniture(
  ctx: Ctx,
  family: string,
  v: { x0: number; y0: number; x1: number; y1: number },
  card: { x: number; y: number; w: number; h: number },
): void {
  // the title block
  ctx.fillStyle = INK.paper;
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.strokeStyle = INK.text;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(card.x, card.y, card.w, card.h);
  ctx.lineWidth = 0.25;
  ctx.strokeRect(card.x + 1.6, card.y + 1.6, card.w - 3.2, card.h - 3.2);
  const cx = card.x + card.w / 2;
  font(ctx, family, 2.2, "600");
  ctx.letterSpacing = "1px";
  label(ctx, "a chart of the harbour and old town of", cx, card.y + 9, {
    color: INK.soft,
    halo: null,
  });
  font(ctx, family, 12, "600");
  ctx.letterSpacing = "2.4px";
  label(ctx, "port lumen", cx, card.y + 21, { color: INK.text, halo: null });
  ctx.letterSpacing = "0px";
  ctx.beginPath();
  ctx.moveTo(cx - 40, card.y + 30);
  ctx.lineTo(cx + 40, card.y + 30);
  ctx.strokeStyle = INK.soft;
  ctx.lineWidth = 0.25;
  ctx.stroke();
  font(ctx, family, 2.6, "500");
  label(ctx, "sheet 3 of 9, surveyed 1906, revised 2026", cx, card.y + 36, {
    color: INK.text,
    halo: null,
  });
  label(ctx, "scale one to four thousand eight hundred", cx, card.y + 40.6, {
    color: INK.text,
    halo: null,
  });
  font(ctx, family, 1.5, "italic 500");
  label(
    ctx,
    "engraved for sanyam.sh/lab/loupe. heights in feet, depths in fathoms.",
    cx,
    card.y + 48,
    { color: INK.soft, halo: null },
  );

  // the compass rose
  const rose = { x: v.x1 - 34, y: v.y0 + 36, r: 16 };
  ctx.save();
  ctx.translate(rose.x, rose.y);
  ctx.strokeStyle = INK.text;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, rose.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rose.r - 2.2, 0, Math.PI * 2);
  ctx.lineWidth = 0.18;
  ctx.stroke();
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const len = k % 9 === 0 ? 2.2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rose.r, Math.sin(a) * rose.r);
    ctx.lineTo(Math.cos(a) * (rose.r - len), Math.sin(a) * (rose.r - len));
    ctx.lineWidth = 0.15;
    ctx.stroke();
  }
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.rotate((k * Math.PI) / 2);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -(rose.r - 3));
      ctx.lineTo(side * 2.6, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fillStyle = side < 0 ? INK.text : INK.paper;
      ctx.fill();
      ctx.lineWidth = 0.2;
      ctx.stroke();
    }
    ctx.restore();
  }
  font(ctx, family, 3, "600");
  label(ctx, "n", 0, -rose.r - 3.4, { color: INK.text, halo: null });
  ctx.restore();

  // the scale bar
  const bar = { x: v.x1 - 92, y: v.y1 - 18, seg: 18 };
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k % 2 === 0 ? INK.text : INK.paper;
    ctx.fillRect(bar.x + k * bar.seg, bar.y, bar.seg, 1.6);
  }
  ctx.strokeStyle = INK.text;
  ctx.lineWidth = 0.2;
  ctx.strokeRect(bar.x, bar.y, bar.seg * 4, 1.6);
  font(ctx, family, 2.2, "500");
  for (let k = 0; k <= 4; k++) {
    label(ctx, String(k * 100), bar.x + k * bar.seg, bar.y - 2.6, {
      color: INK.text,
      halo: INK.land,
      width: 0.6,
    });
  }
  label(ctx, "metres", bar.x + bar.seg * 2, bar.y + 4.4, {
    color: INK.soft,
    halo: INK.land,
    width: 0.6,
  });

  // the border: a ruled frame whose inner line is microprint
  const outer = 4;
  const inner = 7.6;
  ctx.strokeStyle = INK.text;
  ctx.lineWidth = 0.7;
  ctx.strokeRect(
    v.x0 + outer,
    v.y0 + outer,
    v.x1 - v.x0 - outer * 2,
    v.y1 - v.y0 - outer * 2,
  );
  ctx.lineWidth = 0.25;
  ctx.strokeRect(
    v.x0 + inner + 1.6,
    v.y0 + inner + 1.6,
    v.x1 - v.x0 - (inner + 1.6) * 2,
    v.y1 - v.y0 - (inner + 1.6) * 2,
  );
  // the margin outside the frame is paper, not sea
  ctx.fillStyle = INK.paper;
  ctx.beginPath();
  ctx.rect(v.x0 - 1, v.y0 - 1, v.x1 - v.x0 + 2, v.y1 - v.y0 + 2);
  ctx.rect(
    v.x0 + outer,
    v.y0 + outer,
    v.x1 - v.x0 - outer * 2,
    v.y1 - v.y0 - outer * 2,
  );
  ctx.fill("evenodd");

  font(ctx, family, 1.7, "600");
  ctx.letterSpacing = "0.15px";
  const phrase = "sanyam.sh  lab  loupe  ";
  const unit = ctx.measureText(phrase).width;
  ctx.fillStyle = INK.text;
  ctx.textAlign = "left";
  const band = (x: number, y: number, len: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(0, -1.2, len, 2.4);
    ctx.clip();
    for (let t = 0; t < len; t += unit) ctx.fillText(phrase, t, 0);
    ctx.restore();
  };
  const w = v.x1 - v.x0 - inner * 2;
  const h = v.y1 - v.y0 - inner * 2;
  band(v.x0 + inner, v.y0 + inner, w, 0);
  band(v.x1 - inner, v.y0 + inner, h, Math.PI / 2);
  band(v.x1 - inner, v.y1 - inner, w, Math.PI);
  band(v.x0 + inner, v.y1 - inner, h, -Math.PI / 2);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";

  // graticule ticks in the margin, with their degrees
  font(ctx, family, 1.6, "500");
  ctx.fillStyle = INK.soft;
  for (let k = 1; k < 6; k++) {
    const x = v.x0 + ((v.x1 - v.x0) * k) / 6;
    ctx.fillText(`4°${String(10 + k * 2).padStart(2, "0")}′ w`, x, v.y0 + 2);
    ctx.fillText(`4°${String(10 + k * 2).padStart(2, "0")}′ w`, x, v.y1 - 2);
  }
}
