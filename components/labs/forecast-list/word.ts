import { approach } from "@/lib/lerp";
import type { Kind } from "./forecasts";

/*
 * The weather on the word. The picked row wears its own forecast: snow
 * settles on the tops of the letters, rain lands on them and runs down, fog
 * drifts across and softens them, a storm flickers them with its flashes and
 * the sun sweeps a warm glint through them. Leaving the row lets it go: the
 * snow is shaken off, the rain drips away, the rest fades.
 *
 * **The letters are measured, not guessed.** `buildMask` draws the row's text
 * onto a canvas in the row's own font, at the row's own position, and reads
 * the pixels back. That gives an ink test for any point and the top edge of
 * the ink in every column, which is what snow lands on and what rain runs
 * down. Everything here is in CSS px, local to the word's box.
 *
 * The colours are this experiment's own, not tokens, for the reason the
 * card's are: the weather is the subject.
 */

export interface Mask {
  /** the word's box, in the overlay canvas's CSS px */
  x: number;
  y: number;
  w: number;
  h: number;
  /** the text's baseline, local to the box */
  baseline: number;
  /** the first ink row in each column, or Infinity where there is none */
  top: Float32Array;
  ink: Uint8Array;
  /** the text's alpha at `SCALE`, for tinting the letters */
  image: HTMLCanvasElement;
}

const SCALE = 2;
const PAD = 8;

export function buildMask(button: HTMLElement, overlay: DOMRect): Mask | null {
  const node = button.firstChild;
  if (!node) return null;
  const range = document.createRange();
  range.selectNodeContents(button);
  const r = range.getBoundingClientRect();
  const cs = getComputedStyle(button);
  const raw = button.textContent ?? "";
  const text =
    cs.textTransform === "lowercase"
      ? raw.toLowerCase()
      : cs.textTransform === "uppercase"
        ? raw.toUpperCase()
        : raw;

  const w = Math.ceil(r.width + PAD * 2);
  const h = Math.ceil(r.height + 2);
  const image = document.createElement("canvas");
  image.width = w * SCALE;
  image.height = h * SCALE;
  const ctx = image.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if (cs.letterSpacing !== "normal") ctx.letterSpacing = cs.letterSpacing;
  // the range's box is the text's content area, whose top is one font ascent
  // above the baseline
  const baseline = ctx.measureText(text).fontBoundingBoxAscent;
  ctx.fillStyle = "#000";
  ctx.fillText(text, PAD, baseline);

  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  const ink = new Uint8Array(w * h);
  const top = new Float32Array(w).fill(Number.POSITIVE_INFINITY);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[((y * SCALE + 1) * image.width + x * SCALE + 1) * 4 + 3];
      if (a > 110) {
        ink[y * w + x] = 1;
        if (top[x] === Number.POSITIVE_INFINITY) top[x] = y;
      }
    }
  }

  return {
    x: r.left - overlay.left - PAD,
    y: r.top - overlay.top,
    w,
    h,
    baseline,
    top,
    ink,
    image,
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The storm's flashes, as a clock of their own so the word flickers the way a
 * real flash does: a strike, a dip, a weaker second strike and a tail, rather
 * than one pulse.
 */
export class Lightning {
  /** 0 to 1, how bright the current flash is */
  level = 0;
  private wait = 0.9;
  private age = -1;

  step(dt: number) {
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = rand(2.2, 4.2);
      this.age = 0;
    }
    if (this.age < 0) return;
    this.age += dt;
    const a = this.age;
    this.level =
      a < 0.05
        ? 1
        : a < 0.1
          ? 0.2
          : a < 0.17
            ? 0.75
            : Math.max(0, 0.75 - (a - 0.17) * 2.4);
    if (a > 0.5) {
      this.age = -1;
      this.level = 0;
    }
  }
}

const inked = (m: Mask, x: number, y: number) => {
  const xi = Math.round(x);
  const yi = Math.round(y);
  return (
    xi >= 0 && xi < m.w && yi >= 0 && yi < m.h && m.ink[yi * m.w + xi] === 1
  );
};

/** the letters in one colour, for laying over the DOM text */
function tinted(m: Mask, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = m.image.width;
  c.height = m.image.height;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.drawImage(m.image, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export interface WordFx {
  readonly done: boolean;
  /** px of CSS blur the row's text should carry, for fog */
  readonly blur: number;
  /** whether letting go has anything to shake off */
  readonly shakes: boolean;
  step(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  release(): void;
  revive(): void;
}

abstract class Base implements WordFx {
  protected active = true;
  protected level = 0;

  constructor(protected m: Mask) {}

  get blur() {
    return 0;
  }
  get shakes() {
    return false;
  }
  abstract get done(): boolean;
  abstract step(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  release() {
    this.active = false;
  }
  revive() {
    this.active = true;
  }

  /** eases `level` up while picked and down after, on different clocks */
  protected ease(dt: number, rise: number, fall: number) {
    const target = this.active ? 1 : 0;
    this.level +=
      (target - this.level) * approach(this.active ? rise : fall, dt);
    if (!this.active && this.level < 0.005) this.level = 0;
  }

  protected tint(
    ctx: CanvasRenderingContext2D,
    img: HTMLCanvasElement,
    a: number,
  ) {
    if (a <= 0.003) return;
    ctx.globalAlpha = a;
    ctx.drawImage(img, 0, 0, this.m.w, this.m.h);
    ctx.globalAlpha = 1;
  }
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
}

/** a small thing thrown off something, falling and fading */
function fly(bits: Bit[], dt: number, gravity: number): Bit[] {
  for (const b of bits) {
    b.vy += gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age += dt;
  }
  return bits.filter((b) => b.age < b.life);
}

interface RainLook {
  rate: number;
  speed: number;
  streak: string;
  bead: string;
  wet: string;
  wetMax: number;
  /** the share of drops landing on a letter that run down it */
  runners: number;
}

/**
 * Drops fall at a slant and land on the letters' top edges. A few burst, and
 * a share stay on as beads that run down the stroke they landed on for as
 * long as there is ink under them, then drip off its foot. The letters darken
 * as they get wet and dry after.
 */
class Rain extends Base {
  private drops: { x: number; y: number; v: number }[] = [];
  private beads: { x: number; y: number; v: number }[] = [];
  private bits: Bit[] = [];
  private wet = 0;
  private due = 0;
  private sheen: HTMLCanvasElement;

  constructor(
    m: Mask,
    protected look: RainLook,
  ) {
    super(m);
    this.sheen = tinted(m, look.wet);
  }

  override get shakes() {
    return this.beads.length > 0 || this.wet > 0.2;
  }

  get done() {
    return (
      !this.active &&
      this.drops.length === 0 &&
      this.beads.length === 0 &&
      this.bits.length === 0 &&
      this.wet < 0.01
    );
  }

  override release() {
    super.release();
    // shaking the word throws the beads off rather than letting them run
    for (const b of this.beads) {
      this.bits.push({
        x: b.x,
        y: b.y,
        vx: rand(-60, 60),
        vy: rand(-80, -20),
        age: 0,
        life: 0.6,
        r: 1.2,
      });
    }
    this.beads = [];
  }

  step(dt: number) {
    const { m, look } = this;
    this.ease(dt, 0.25, 0.3);
    this.wet +=
      ((this.active ? 1 : 0) - this.wet) *
      approach(this.active ? 1.4 : 0.5, dt);

    this.due += look.rate * this.level * dt;
    while (this.due >= 1) {
      this.due -= 1;
      this.drops.push({
        x: rand(-30, m.w),
        y: rand(-30, -8),
        v: rand(0.85, 1.15) * look.speed,
      });
    }

    const kept: typeof this.drops = [];
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x += d.v * 0.2 * dt;
      const col = Math.round(d.x);
      const surface =
        col >= 0 && col < m.w ? m.top[col] : Number.POSITIVE_INFINITY;
      if (d.y >= surface) {
        this.splash(d.x, surface, 2);
        if (this.active && Math.random() < look.runners) {
          this.beads.push({ x: col, y: surface + 1, v: 10 });
        }
      } else if (d.y >= m.baseline + 1) {
        this.splash(d.x, m.baseline + 1, 1);
      } else {
        kept.push(d);
      }
    }
    this.drops = kept;

    const beads: typeof this.beads = [];
    for (const b of this.beads) {
      b.v = Math.min(b.v + 240 * dt, 80);
      b.y += b.v * dt;
      if (inked(m, b.x, b.y + 1.5)) {
        beads.push(b);
      } else {
        this.bits.push({
          x: b.x,
          y: b.y,
          vx: 0,
          vy: b.v,
          age: 0,
          life: 0.35,
          r: 1.1,
        });
      }
    }
    this.beads = beads;
    this.bits = fly(this.bits, dt, 520);
  }

  private splash(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.bits.push({
        x,
        y,
        vx: rand(-40, 40),
        vy: rand(-70, -25),
        age: 0,
        life: 0.28,
        r: 0.8,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { look } = this;
    this.tint(ctx, this.sheen, this.wet * look.wetMax);

    ctx.strokeStyle = look.streak;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const d of this.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1.8, d.y - 9);
    }
    ctx.stroke();

    ctx.fillStyle = look.bead;
    ctx.strokeStyle = look.bead;
    for (const b of this.beads) {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(b.x, Math.max(b.y - 7, b.y - b.v * 0.1));
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = look.streak;
    for (const b of this.bits) {
      ctx.globalAlpha = 1 - b.age / b.life;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** the storm is heavier rain, and the letters flicker with the card's flashes */
class Storm extends Rain {
  private flashTint: HTMLCanvasElement;

  constructor(
    m: Mask,
    private lightning: Lightning,
  ) {
    super(m, {
      rate: 80,
      speed: 460,
      streak: "rgba(109,40,217,0.5)",
      bead: "#ddd6fe",
      wet: "#3b0764",
      wetMax: 0.5,
      runners: 0.3,
    });
    this.flashTint = tinted(m, "#ddd6fe");
  }

  override draw(ctx: CanvasRenderingContext2D) {
    super.draw(ctx);
    this.tint(ctx, this.flashTint, this.lightning.level * this.level * 0.92);
  }
}

/** the most snow a column of a letter holds, in px */
const PILE = 6;

/**
 * Flakes drift down and settle on the letters' top edges, building a cap
 * that slumps sideways once it is steeper than snow sits. Flakes that miss
 * fall through the gaps. Letting go knocks the whole cap off in clumps.
 */
class Snow extends Base {
  private flakes: { x: number; y: number; r: number; v: number; ph: number }[] =
    [];
  private pile: Float32Array;
  private bits: Bit[] = [];
  private due = 0;
  private t = 0;
  private chill: HTMLCanvasElement;

  constructor(m: Mask) {
    super(m);
    this.pile = new Float32Array(m.w);
    this.chill = tinted(m, "#4338ca");
  }

  override get shakes() {
    return this.pile.some((p) => p > 0.5);
  }

  get done() {
    return (
      !this.active &&
      this.flakes.length === 0 &&
      this.bits.length === 0 &&
      this.level === 0 &&
      !this.pile.some((p) => p > 0)
    );
  }

  override release() {
    super.release();
    const { m, pile } = this;
    for (let x = 0; x < m.w; x += 2) {
      if (pile[x] < 0.5) continue;
      this.bits.push({
        x,
        y: m.top[x] - pile[x] / 2,
        vx: rand(-45, 45),
        vy: rand(-90, -20),
        age: 0,
        life: rand(0.6, 0.9),
        r: Math.min(2.6, pile[x] * 0.45 + 0.7),
      });
    }
    pile.fill(0);
  }

  step(dt: number) {
    const { m, pile } = this;
    this.t += dt;
    this.ease(dt, 0.4, 0.3);

    this.due += 38 * this.level * dt;
    while (this.due >= 1) {
      this.due -= 1;
      this.flakes.push({
        x: rand(-4, m.w + 4),
        y: rand(-30, -6),
        r: rand(1, 2.2),
        v: rand(26, 44),
        ph: rand(0, Math.PI * 2),
      });
    }

    const kept: typeof this.flakes = [];
    for (const f of this.flakes) {
      f.y += f.v * dt;
      f.x += Math.sin(this.t * 2 + f.ph) * 14 * dt;
      const col = Math.round(f.x);
      const top = col >= 0 && col < m.w ? m.top[col] : Number.POSITIVE_INFINITY;
      if (this.active && f.y + f.r >= top - pile[col]) {
        for (let dx = -2; dx <= 2; dx++) {
          const c = col + dx;
          if (c < 0 || c >= m.w || Math.abs(m.top[c] - top) > 2) continue;
          pile[c] = Math.min(
            PILE,
            pile[c] + f.r * 1.4 * (1 - Math.abs(dx) / 3),
          );
        }
      } else if (f.y < m.h + 6) {
        kept.push(f);
      }
    }
    this.flakes = kept;

    // snow slumps: a column much taller than its neighbour on the same stroke
    // gives some of itself away
    for (let x = 0; x < m.w - 1; x++) {
      if (Math.abs(m.top[x] - m.top[x + 1]) > 1.5) continue;
      const d = pile[x] - pile[x + 1];
      if (Math.abs(d) > 1.2) {
        const move = (d - Math.sign(d) * 1.2) * 0.3;
        pile[x] -= move;
        pile[x + 1] += move;
      }
      // and it settles into a soft drift rather than a row of peaks
      const mean = (pile[x] + pile[x + 1]) / 2;
      pile[x] += (mean - pile[x]) * 0.12;
      pile[x + 1] += (mean - pile[x + 1]) * 0.12;
    }

    this.bits = fly(this.bits, dt, 480);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { m, pile } = this;
    this.tint(ctx, this.chill, this.level * 0.35);

    ctx.fillStyle = "#eef2f7";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 0.9;
    let run: number[] = [];
    const flush = () => {
      if (run.length > 1) {
        const first = run[0];
        const last = run[run.length - 1];
        ctx.beginPath();
        ctx.moveTo(first, m.top[first] + 0.3);
        for (const x of run) ctx.lineTo(x, m.top[x] - pile[x]);
        ctx.lineTo(last, m.top[last] + 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        for (const [i, x] of run.entries()) {
          if (i === 0) ctx.moveTo(x, m.top[x] - pile[x]);
          else ctx.lineTo(x, m.top[x] - pile[x]);
        }
        ctx.stroke();
      }
      run = [];
    };
    for (let x = 0; x < m.w; x++) {
      const prev = run.at(-1);
      const joins =
        prev !== undefined && Math.abs(m.top[x] - m.top[prev]) <= 1.5;
      if (pile[x] > 0.25 && Number.isFinite(m.top[x])) {
        if (!joins) flush();
        run.push(x);
      } else {
        flush();
      }
    }
    flush();

    // a flake is a soft dot rather than a ringed one, which read as bubbles
    ctx.fillStyle = "#cbd5e1";
    const flake = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const f of this.flakes) flake(f.x, f.y, f.r);
    for (const b of this.bits) {
      ctx.globalAlpha = 1 - (b.age / b.life) ** 2;
      flake(b.x, b.y, b.r);
    }
    ctx.globalAlpha = 1;
  }
}

/** banks of fog drifting through the word, which also goes soft */
class Fog extends Base {
  private banks = Array.from({ length: 6 }, (_, i) => ({
    x: rand(0, 1),
    y: rand(0.15, 0.85),
    rx: rand(28, 56),
    ry: rand(8, 15),
    v: rand(12, 26) * (i % 2 ? 1 : 0.7),
    a: rand(0.7, 0.95),
  }));

  override get blur() {
    return this.level * 1.2;
  }

  get done() {
    return !this.active && this.level === 0;
  }

  step(dt: number) {
    this.ease(dt, 0.6, 0.45);
    for (const b of this.banks) {
      b.x += (b.v * dt) / this.m.w;
      if (b.x * this.m.w - b.rx > this.m.w) b.x = -b.rx / this.m.w;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { m } = this;
    for (const b of this.banks) {
      ctx.save();
      ctx.translate(b.x * m.w, b.y * m.h);
      ctx.scale(b.rx / b.ry, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.ry);
      g.addColorStop(0, `rgba(255,255,255,${b.a * this.level})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-b.ry, -b.ry, b.ry * 2, b.ry * 2);
      ctx.restore();
    }
  }
}

/** a warm band sweeping through the letters, and glints on their tops */
class Sun extends Base {
  private t = 0;
  private warm: HTMLCanvasElement;
  private band: HTMLCanvasElement;
  private glints: { x: number; age: number }[] = [];
  private due = 0;

  constructor(m: Mask) {
    super(m);
    this.warm = tinted(m, "#c2410c");
    this.band = document.createElement("canvas");
    this.band.width = m.image.width;
    this.band.height = m.image.height;
  }

  get done() {
    return !this.active && this.level === 0 && this.glints.length === 0;
  }

  step(dt: number) {
    const { m } = this;
    this.t += dt;
    this.ease(dt, 0.35, 0.3);
    this.due += 3 * this.level * dt;
    while (this.due >= 1) {
      this.due -= 1;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.floor(rand(0, m.w));
        if (Number.isFinite(m.top[x])) {
          this.glints.push({ x, age: 0 });
          break;
        }
      }
    }
    for (const g of this.glints) g.age += dt;
    this.glints = this.glints.filter((g) => g.age < 0.5);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { m } = this;
    this.tint(ctx, this.warm, this.level * 0.45);

    const bctx = this.band.getContext("2d");
    if (bctx && this.level > 0.01) {
      const span = m.w + 120;
      const x = ((this.t * 120) % span) - 60;
      bctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      bctx.globalCompositeOperation = "source-over";
      bctx.clearRect(0, 0, m.w, m.h);
      const g = bctx.createLinearGradient(x - 40, 0, x + 40, 0);
      g.addColorStop(0, "rgba(251,191,36,0)");
      g.addColorStop(0.5, "rgba(251,191,36,1)");
      g.addColorStop(1, "rgba(251,191,36,0)");
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, m.w, m.h);
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = "destination-in";
      bctx.drawImage(m.image, 0, 0);
      this.tint(ctx, this.band, this.level);
    }

    ctx.fillStyle = "#f59e0b";
    for (const g of this.glints) {
      const s = Math.sin((g.age / 0.5) * Math.PI) * 3.6 * this.level;
      const y = m.top[g.x] - 1;
      ctx.beginPath();
      ctx.moveTo(g.x, y - s);
      ctx.quadraticCurveTo(g.x, y, g.x + s, y);
      ctx.quadraticCurveTo(g.x, y, g.x, y + s);
      ctx.quadraticCurveTo(g.x, y, g.x - s, y);
      ctx.quadraticCurveTo(g.x, y, g.x, y - s);
      ctx.fill();
    }
  }
}

export function makeWordFx(kind: Kind, m: Mask, lightning: Lightning): WordFx {
  switch (kind) {
    case "sun":
      return new Sun(m);
    case "fog":
      return new Fog(m);
    case "rain":
      return new Rain(m, {
        rate: 55,
        speed: 380,
        streak: "rgba(37,99,235,0.6)",
        bead: "#bfdbfe",
        wet: "#1e3a8a",
        wetMax: 0.55,
        runners: 0.4,
      });
    case "snow":
      return new Snow(m);
    case "storm":
      return new Storm(m, lightning);
  }
}

/** draws one effect in the overlay, local to its word */
export function drawFx(
  ctx: CanvasRenderingContext2D,
  fx: WordFx,
  m: Mask,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, m.x * dpr, m.y * dpr);
  fx.draw(ctx);
}
