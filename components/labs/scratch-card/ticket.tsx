"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CopyMark } from "@/components/ui/copy-mark";
import { cn } from "@/lib/utils";
import type { Bounds } from "./dust";
import {
  COLS,
  cellBox,
  clearAll,
  clearTo,
  coverIn,
  createFoil,
  FOIL_H,
  FOIL_W,
  type Foil,
  PLAY_H,
  paintFoil,
  ROWS,
  reach,
  scratch,
} from "./foil";
import { ICONS, INKS } from "./marks";
import { type Card, PRIZES } from "./prizes";
import {
  armScratch,
  holdScratch,
  moveScratch,
  playClear,
  playFound,
  playLose,
  playWin,
  startScratch,
  stopScratch,
} from "./scratch-sound";

/**
 * What the ticket hands the stage: where its crumbs go. Everything is in stage
 * pixels, since a crumb can skid off the card onto the table.
 */
export interface DustApi {
  shave: (x: number, y: number, dx: number, dy: number, speed: number) => void;
  flake: (x: number, y: number, fromX: number, fromY: number) => void;
  push: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    reach: number,
    speed: number,
  ) => void;
  bounds: (b: Bounds) => void;
  gust: (x: number, y: number) => void;
}

export type Outcome = "win" | "lose";

const CELLS = COLS * ROWS;
/**
 * A cell counts as found once this share of the coating over its symbol is
 * left. What is tested is the symbol's own footprint, `MARK` foil pixels
 * square at the cell's middle, since that is what a reader is looking at. A
 * box most of the cell's size needed two passes per row, and a single pass
 * that plainly showed three stars left the card unfinished.
 */
const FOUND_AT = 0.5;
const MARK = 76;
/** with no three of a kind found, letting go finishes the card below this */
const DONE_AT = 0.3;
/** seconds for the last of the coating to come away */
const WAVE = 0.42;
/** the strip's prize counts as up this far through that */
const UP_AT = 0.55;
/** seconds for the opening glint across the foil */
const SWEEP = 1.1;
/** foil pixels a second, for the scratch the keyboard asks for */
const AUTO_SPEED = 4600;
/** coating a shaving is worth, in grid cells, so dust follows what came off */
const PER_CRUMB = 2.6;
/** the coin's minor half-width in foil pixels, for how far it pushes crumbs */
const COIN_REACH = 30;
/** where the light rests on a flat card */
const REST = { x: 0.32, y: 0.38 };
/** degrees the card leans toward the pointer at the edge of its box */
const TILT = 7;

const now = () => performance.now() / 1000;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** a short pulse on a phone that has a motor, and nothing anywhere else */
function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * How wide the coin bites, from what the pointer reports. A pen presses, so
 * its pressure scales the edge. A finger's contact patch is its own width. A
 * mouse reports neither, so it is the coin as drawn.
 */
function biteOf(e: PointerEvent): number {
  if (e.pointerType === "pen" && e.pressure > 0) {
    return 0.65 + e.pressure * 0.75;
  }
  if (e.pointerType === "touch") {
    const w = Math.max(e.width, e.height);
    if (w > 1) return clamp(w / 22, 0.85, 1.4);
  }
  return 1;
}

/** the keyboard's scratch: nine passes across the panel, back and forth */
const AUTO_PATH = (() => {
  const pts: { x: number; y: number }[] = [];
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const y = FOIL_H * (0.06 + (0.88 * i) / (rows - 1));
    const a = FOIL_W * 0.04;
    const b = FOIL_W * 0.96;
    if (i % 2 === 0) pts.push({ x: a, y }, { x: b, y: y + 6 });
    else pts.push({ x: b, y }, { x: a, y: y + 6 });
  }
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y),
    );
  }
  return { pts, lengths, total: lengths[lengths.length - 1] };
})();

function along(d: number): { x: number; y: number } {
  const { pts, lengths } = AUTO_PATH;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  const span = lengths[i] - lengths[i - 1] || 1;
  const t = clamp((d - lengths[i - 1]) / span, 0, 1);
  return {
    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
  };
}

export function Ticket({
  card,
  dust,
  stage,
  reduce,
  onScratched,
  onSettled,
}: {
  card: Card;
  dust: DustApi;
  stage: React.RefObject<HTMLDivElement | null>;
  reduce: boolean;
  onScratched: () => void;
  /** the card is finished, and whether a keyboard finished it */
  onSettled: (outcome: Outcome, viaKey: boolean) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dimple = useRef<HTMLDivElement>(null);
  const codeButton = useRef<HTMLButtonElement>(null);
  const seen = useInView(panel, { once: true, amount: 0.6 });

  const [ready, setReady] = useState(false);
  const [found, setFound] = useState<boolean[]>(() => Array(CELLS).fill(false));
  const [matched, setMatched] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [auto, setAuto] = useState(false);
  const [copied, setCopied] = useState(false);
  const [glintFrom, setGlintFrom] = useState<"left" | "right">("left");

  /*
   * The card is a thing in the hand. It leans toward a hovering pointer, lies
   * flat under a press, and lifts off the table as it is pointed at. The lean
   * is two springs, read by the transform, the light on the foil and the light
   * on the paper, so all three agree.
   */
  const tiltX = useSpring(0, { stiffness: 170, damping: 20 });
  const tiltY = useSpring(0, { stiffness: 170, damping: 20 });
  const lifted = useMotionValue(0.55);
  const lift = useSpring(lifted, { stiffness: 260, damping: 26 });
  const shadow = useTransform(lift, (l) =>
    [
      "0 0 0 1px var(--color-stroke)",
      `0 1px 2px rgb(0 0 0 / ${0.07 - 0.02 * l})`,
      `0 ${3 + 9 * l}px ${6 + 16 * l}px -4px rgb(0 0 0 / ${0.05 + 0.04 * l})`,
      `0 ${8 + 24 * l}px ${16 + 40 * l}px -12px rgb(0 0 0 / ${0.04 + 0.07 * l})`,
    ].join(", "),
  );

  // Everything the frame loop reads lives here, so a scratch renders nothing.
  const live = useRef({
    foil: null as Foil | null,
    light: { ...REST },
    coin: { ...REST },
    sweepAt: -1,
    pressing: false,
    touch: false,
    last: { x: 0, y: 0, t: 0 },
    speed: 0,
    bite: 1,
    lastMove: 0,
    lastBuzz: 0,
    held: false,
    debt: 0,
    touched: false,
    found: Array<boolean>(CELLS).fill(false),
    matched: false,
    auto: null as { at: number; d: number } | null,
    wave: null as {
      x: number;
      y: number;
      at: number;
      to: number;
      seed: number;
    } | null,
    up: false,
    done: false,
    viaKey: false,
    dirty: true,
    lastT: 0,
    raf: 0,
    reduce,
    card,
  });
  live.current.reduce = reduce;
  live.current.card = card;

  /**
   * The panel's own box, untransformed. The card tilts, and a tilted card's
   * rect is the box round its projection, so the panel is placed off the slot,
   * which never moves, plus its layout offset inside the card.
   */
  const panelBox = useCallback(() => {
    const s = slot.current?.getBoundingClientRect();
    const p = panel.current;
    if (!s || !p) return null;
    return {
      left: s.left + p.offsetLeft,
      top: s.top + p.offsetTop,
      w: p.offsetWidth,
      h: p.offsetHeight,
    };
  }, []);

  /** foil pixels to stage pixels, read off the rects on the moment */
  const toStage = useCallback(() => {
    const p = panelBox();
    const sl = slot.current?.getBoundingClientRect();
    const st = stage.current?.getBoundingClientRect();
    if (!p || !sl || !st) return null;
    const k = p.w / FOIL_W;
    return {
      k,
      card: {
        x: sl.left - st.left,
        y: sl.top - st.top,
        w: sl.width,
        h: sl.height,
      },
      at: (x: number, y: number) => ({
        x: p.left - st.left + x * k,
        y: p.top - st.top + y * k,
      }),
    };
  }, [panelBox, stage]);

  /** which symbols have come clear, checked after every stroke */
  const look = useCallback(() => {
    const s = live.current;
    const foil = s.foil;
    if (!foil) return;
    let changed = false;
    for (let i = 0; i < CELLS; i++) {
      if (s.found[i]) continue;
      // the symbol sits in the middle of its cell, so that is what is tested
      const b = cellBox(i);
      const left = coverIn(
        foil,
        b.x + (b.w - MARK) / 2,
        b.y + (b.h - MARK) / 2,
        MARK,
        MARK,
      );
      if (left > FOUND_AT) continue;
      s.found[i] = true;
      changed = true;
      const mark = s.card.cells[i];
      const same = s.card.cells.filter(
        (m, j) => m === mark && s.found[j],
      ).length;
      const count = s.found.filter(Boolean).length;
      if (same === 3 && s.card.win === mark && !s.matched) {
        s.matched = true;
        setMatched(true);
        playWin();
        if (s.touch) buzz([18, 50, 28]);
      } else {
        playFound(count - 1, same === 2);
        if (s.touch) buzz(same === 2 ? [10, 40, 10] : 12);
      }
    }
    if (changed) setFound([...s.found]);
  }, []);

  /** the coin from one point to the next, which every way of scratching ends in */
  const stroke = useCallback(
    (x0: number, y0: number, x1: number, y1: number, speed: number) => {
      const s = live.current;
      const foil = s.foil;
      if (!foil || s.done) return;
      const { tears, on } = scratch(foil, x0, y0, x1, y1, speed, s.bite);
      s.dirty = true;
      s.coin = { x: x1 / FOIL_W, y: y1 / FOIL_H };
      moveScratch(speed / FOIL_W, on, x1 / FOIL_W);
      const t = now();
      if (s.touch && on > 0.15 && speed > 120 && t - s.lastBuzz > 0.05) {
        s.lastBuzz = t;
        buzz(Math.round(2 + on * 6));
      }
      if (!s.touched) {
        s.touched = true;
        onScratched();
      }
      look();
      if (s.reduce) return;

      const map = toStage();
      if (!map) return;
      const pace = speed * map.k;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const from = map.at(x0, y0);
      const to = map.at(x1, y1);
      dust.push(from.x, from.y, to.x, to.y, COIN_REACH * s.bite * map.k, pace);
      let spawned = 0;
      for (const tear of tears) {
        s.debt += tear.amount;
        while (s.debt >= PER_CRUMB && spawned < 40) {
          s.debt -= PER_CRUMB;
          spawned++;
          const p = map.at(tear.x, tear.y);
          dust.shave(p.x, p.y, dx, dy, pace);
        }
      }
    },
    [dust, look, onScratched, toStage],
  );

  /** the prize strip coming up, partway through the last of the coating going */
  const settle = useCallback(() => {
    const s = live.current;
    if (s.up) return;
    s.up = true;
    const result: Outcome = s.card.win ? "win" : "lose";
    if (result === "win" && !s.matched) {
      // the coating went before the third symbol was found, so the match is
      // announced now, as it comes up
      s.matched = true;
      setMatched(true);
      playWin();
    }
    if (result === "lose") {
      playLose();
      if (s.touch) buzz(30);
    }
    s.found.fill(true);
    setFound([...s.found]);
    setGlintFrom(tiltY.get() >= 0 ? "left" : "right");
    setOutcome(result);
    onSettled(result, s.viaKey);
  }, [onSettled, tiltY]);

  /** the last of the coating going, outward from where the coin stopped */
  const finish = useCallback(
    (x: number, y: number) => {
      const s = live.current;
      const foil = s.foil;
      if (!foil || s.done) return;
      s.done = true;
      s.auto = null;
      stopScratch();
      playClear();
      if (s.reduce) {
        clearAll(foil);
        s.dirty = true;
        settle();
        return;
      }
      s.wave = {
        x,
        y,
        at: now(),
        to: reach(x, y) * 1.15,
        seed: Math.random() * 10,
      };
    },
    [settle],
  );

  const frame = useCallback(() => {
    const s = live.current;
    s.raf = 0;
    const ctx = canvas.current?.getContext("2d");
    const foil = s.foil;
    if (!ctx || !foil) return;
    const t = now();
    const dt = Math.min(0.05, Math.max(0, t - s.lastT));
    s.lastT = t;
    let busy = false;

    // the keyboard's scratch, walked along its path at a coin's pace
    if (s.auto) {
      const d = Math.min(AUTO_PATH.total, (t - s.auto.at) * AUTO_SPEED);
      let from = s.auto.d;
      // stop at every corner on the way, so a frame never cuts one
      for (const corner of AUTO_PATH.lengths) {
        if (corner > from && corner < d) {
          const a = along(from);
          const b = along(corner);
          stroke(a.x, a.y, b.x, b.y, AUTO_SPEED);
          from = corner;
        }
      }
      const a = along(from);
      const b = along(d);
      stroke(a.x, a.y, b.x, b.y, AUTO_SPEED);
      s.auto.d = d;
      if (d >= AUTO_PATH.total) {
        s.auto = null;
        setAuto(false);
        finish(b.x, b.y);
      }
      busy = true;
    }

    if (s.wave) {
      const p = Math.min(1, (t - s.wave.at) / WAVE);
      const r = easeOut(p) * s.wave.to;
      const torn = clearTo(foil, s.wave.x, s.wave.y, r, s.wave.seed);
      s.dirty = true;
      const map = toStage();
      if (map) {
        dust.bounds(map.card);
        const from = map.at(s.wave.x, s.wave.y);
        for (const tear of torn) {
          if (Math.random() > 0.07 * tear.amount) continue;
          const at = map.at(tear.x, tear.y);
          dust.flake(at.x, at.y, from.x, from.y);
        }
      }
      if (p >= UP_AT) settle();
      if (p >= 1) {
        // the prize is up, so everything the scratch left on the card is
        // blown off it, outward from where the coin stopped
        if (map) {
          const from = map.at(s.wave.x, s.wave.y);
          dust.gust(from.x, from.y);
        }
        s.wave = null;
      } else busy = true;
    }

    // the light: the opening glint, then the coin under a press, then the tilt
    let target = s.coin;
    if (!s.pressing && !s.auto) {
      target = {
        x: REST.x + (tiltY.get() / TILT) * 0.8,
        y: REST.y - (tiltX.get() / TILT) * 0.7,
      };
    }
    if (s.sweepAt >= 0) {
      const p = Math.min(1, (t - s.sweepAt) / SWEEP);
      s.light = { x: -0.3 + 1.6 * easeInOut(p), y: 0.5 };
      s.dirty = true;
      if (p >= 1) s.sweepAt = -1;
      busy = true;
    } else {
      const k = s.reduce ? 1 : 1 - Math.exp(-dt / 0.1);
      const dx = target.x - s.light.x;
      const dy = target.y - s.light.y;
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) {
        s.light = { x: s.light.x + dx * k, y: s.light.y + dy * k };
        s.dirty = true;
        busy = true;
      }
    }
    if (tiltX.isAnimating() || tiltY.isAnimating()) busy = true;

    // a coin held still on the card makes no sound
    if (s.pressing && !s.held && t - s.lastMove > 0.07) {
      s.held = true;
      holdScratch();
    }
    if (s.pressing) busy = true;

    if (s.dirty) {
      paintFoil(ctx, foil, s.light.x, s.light.y);
      // the paper catches the same light, softly, since it is matte
      const node = face.current;
      if (node) {
        node.style.setProperty("--lx", `${(s.light.x * 100).toFixed(1)}%`);
        node.style.setProperty("--ly", `${(s.light.y * 100).toFixed(1)}%`);
      }
      s.dirty = false;
    }
    if (busy) s.raf = requestAnimationFrame(frame);
  }, [dust, finish, settle, stroke, tiltX, tiltY, toStage]);

  const kick = useCallback(() => {
    const s = live.current;
    if (s.raf) return;
    s.lastT = now();
    s.raf = requestAnimationFrame(frame);
  }, [frame]);

  // the lean is also where the raised print throws its shadow, and every change
  // to it relights the foil
  useEffect(() => {
    const write = () => {
      const node = face.current;
      if (!node) return;
      node.style.setProperty("--tx", (tiltY.get() / TILT).toFixed(3));
      node.style.setProperty("--ty", (-tiltX.get() / TILT).toFixed(3));
      live.current.dirty = true;
      kick();
    };
    const offX = tiltX.on("change", write);
    const offY = tiltY.on("change", write);
    return () => {
      offX();
      offY();
    };
  }, [kick, tiltX, tiltY]);

  // the foil is printed once the face is in, since its question marks are set
  // in it
  useEffect(() => {
    let alive = true;
    const s = live.current;
    void document.fonts.ready.then(() => {
      const node = panel.current;
      if (!alive || !node) return;
      s.foil = createFoil(getComputedStyle(node).fontFamily);
      s.dirty = true;
      setReady(true);
      kick();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (s.pressing || s.auto) stopScratch();
    };
  }, [kick]);

  // one glint across the foil when it first comes into view, which is the
  // only thing at rest saying this is metal and not a grey box
  useEffect(() => {
    const s = live.current;
    if (!seen || !ready || reduce || s.touched) return;
    s.sweepAt = now();
    kick();
  }, [seen, ready, reduce, kick]);

  /*
   * The gesture is bound to the slot, which never tilts, so the card leaning
   * toward the pointer cannot move the surface the pointer is tested against.
   * Once the prize is up the card takes no more presses.
   */
  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const s = live.current;
    const inPanel = (e: PointerEvent) => {
      const p = panelBox();
      if (!p) return null;
      const u = (e.clientX - p.left) / p.w;
      const v = (e.clientY - p.top) / p.h;
      return { u, v, x: u * FOIL_W, y: v * FOIL_H, p };
    };
    const lean = (e: PointerEvent) => {
      if (s.reduce || s.pressing) return;
      const r = node.getBoundingClientRect();
      const u = clamp((e.clientX - r.left) / r.width, 0, 1);
      const v = clamp((e.clientY - r.top) / r.height, 0, 1);
      // the edge under the pointer goes back, the way a card held by its
      // middle tips toward a finger resting on its edge
      tiltY.set((u - 0.5) * 2 * TILT);
      tiltX.set((0.5 - v) * 2 * TILT);
    };
    const press = (on: boolean, e?: PointerEvent) => {
      const d = dimple.current;
      if (d && e) {
        const r = node.getBoundingClientRect();
        d.style.setProperty("--px", `${e.clientX - r.left}px`);
        d.style.setProperty("--py", `${e.clientY - r.top}px`);
      }
      if (d) d.style.opacity = on ? "1" : "0";
      lifted.set(on ? 0.12 : node.matches(":hover") ? 1 : 0.55);
      if (on) {
        // a press lays the card flat on the table
        tiltX.set(0);
        tiltY.set(0);
      }
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      s.touch = e.pointerType === "touch";
      const map = toStage();
      if (map) dust.bounds(map.card);
      if (s.done) return;
      const at = inPanel(e);
      if (!at || s.auto || !s.foil) return;
      if (at.u < 0 || at.u > 1 || at.v < 0 || at.v > 1) return;
      node.setPointerCapture(e.pointerId);
      armScratch();
      startScratch();
      s.pressing = true;
      s.held = false;
      s.sweepAt = -1;
      s.bite = biteOf(e);
      s.last = { x: at.x, y: at.y, t: e.timeStamp };
      s.lastMove = now();
      press(true, e);
      stroke(at.x, at.y, at.x, at.y, 0);
      kick();
    };
    const move = (e: PointerEvent) => {
      if (s.pressing) {
        const at = inPanel(e);
        if (!at) return;
        const dt = Math.max(0.004, (e.timeStamp - s.last.t) / 1000);
        const d = Math.hypot(at.x - s.last.x, at.y - s.last.y);
        if (d < 0.5) return;
        s.speed += (d / dt - s.speed) * 0.5;
        s.bite += (biteOf(e) - s.bite) * 0.3;
        stroke(s.last.x, s.last.y, at.x, at.y, s.speed);
        s.last = { x: at.x, y: at.y, t: e.timeStamp };
        s.lastMove = now();
        s.held = false;
        const d2 = dimple.current;
        if (d2) {
          const r = node.getBoundingClientRect();
          d2.style.setProperty("--px", `${e.clientX - r.left}px`);
          d2.style.setProperty("--py", `${e.clientY - r.top}px`);
        }
        kick();
        return;
      }
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      s.sweepAt = -1;
      lifted.set(1);
      lean(e);
      kick();
    };
    const up = () => {
      if (!s.pressing) return;
      s.pressing = false;
      s.speed = 0;
      stopScratch();
      press(false);
      const foil = s.foil;
      if (foil) {
        const all = s.found.every(Boolean);
        const left = coverIn(foil, 0, 0, FOIL_W, FOIL_H);
        if (s.matched || all || left < DONE_AT) finish(s.last.x, s.last.y);
      }
      kick();
    };
    const leave = (e: PointerEvent) => {
      if (s.pressing || e.pointerType === "touch") return;
      tiltX.set(0);
      tiltY.set(0);
      lifted.set(0.55);
      kick();
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("lostpointercapture", up);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("lostpointercapture", up);
      node.removeEventListener("pointerleave", leave);
    };
  }, [dust, finish, kick, lifted, panelBox, stroke, tiltX, tiltY, toStage]);

  // a keyboard press scratches the card for you, along the same coin and with
  // the same sound. `detail` of 0 is what says no pointer was involved.
  const keyScratch = (e: MouseEvent) => {
    const s = live.current;
    if (e.detail !== 0 || s.done || s.auto || !s.foil) return;
    armScratch();
    s.viaKey = true;
    s.sweepAt = -1;
    s.bite = 1;
    if (s.reduce) {
      s.touched = true;
      onScratched();
      finish(FOIL_W / 2, FOIL_H / 2);
      return;
    }
    startScratch();
    s.auto = { at: now(), d: 0 };
    setAuto(true);
    kick();
  };

  // the cover the keyboard was on is gone, so focus goes to the code under it
  useEffect(() => {
    if (outcome === "win" && live.current.viaKey) codeButton.current?.focus();
  }, [outcome]);

  const copy = () => {
    void navigator.clipboard?.writeText(card.code).catch(() => {});
    // the code is on screen, so a clipboard that refuses still gets the tick
    setCopied(true);
  };
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const isUp = outcome !== null;
  const play = (PLAY_H / FOIL_H) * 100;

  return (
    <div ref={slot} className="relative w-[min(72cqw,21rem)]">
      <motion.div
        ref={face}
        style={{
          rotateX: tiltX,
          rotateY: tiltY,
          transformPerspective: 900,
          // the panel's 8px corner plus the rim, so the two curves stay
          // concentric
          borderRadius: 13,
          boxShadow: shadow,
        }}
        className="relative bg-bg p-1.5"
      >
        {/* touch-none on the panel alone, so a finger scratches the card and a
            thumb anywhere else on the stage still scrolls */}
        <div
          ref={panel}
          className="@container relative aspect-16/13 w-full touch-none"
        >
          {/* the print under the coating: a fine security pattern, which is
              what a real ticket prints so a light behind it reads nothing */}
          <div
            inert={!isUp}
            aria-hidden={!isUp}
            className={cn(
              "absolute inset-0 overflow-hidden rounded-[8px] bg-surface ring-1 ring-stroke ring-inset transition-opacity duration-150",
              "bg-[repeating-linear-gradient(135deg,var(--color-stroke-soft)_0_1px,transparent_1px_7px)]",
              !ready && "opacity-0",
            )}
          >
            <ul
              style={{ height: `${play}%` }}
              className="absolute inset-x-0 top-0 grid grid-cols-3 grid-rows-3"
            >
              {card.cells.map((mark, i) => {
                const Icon = ICONS[mark];
                const winner = matched && mark === card.win;
                return (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a cell is its place on the card, and the card never reorders
                    key={i}
                    className={cn(
                      "grid place-items-center transition-opacity duration-300",
                      isUp && card.win && !winner && "opacity-35",
                    )}
                  >
                    <motion.span
                      animate={
                        found[i] ? { scale: [1, 1.22, 1] } : { scale: 1 }
                      }
                      transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
                      style={{ color: INKS[mark] }}
                      className="relative grid place-items-center"
                    >
                      {winner ? (
                        <motion.span
                          aria-hidden="true"
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            duration: 0.45,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                          style={{
                            background: `color-mix(in srgb, ${INKS[mark]} 13%, transparent)`,
                            boxShadow: `0 0 0 1.5px color-mix(in srgb, ${INKS[mark]} 55%, transparent)`,
                          }}
                          className="absolute size-[150%] rounded-full"
                        />
                      ) : null}
                      <Icon
                        weight="fill"
                        className="relative size-[clamp(1.1rem,8.5cqw,2rem)]"
                      />
                      <span className="sr-only">{mark}</span>
                    </motion.span>
                  </li>
                );
              })}
            </ul>

            <div
              style={{ height: `${100 - play}%` }}
              className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-0.5 border-stroke border-t"
            >
              {outcome === "win" && card.win ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-meta text-text-secondary">
                    {PRIZES[card.win]}
                  </span>
                  <CodeButton
                    ref={codeButton}
                    code={card.code}
                    copied={copied}
                    onCopy={copy}
                    glint={reduce ? null : glintFrom}
                  />
                </motion.div>
              ) : null}
              {outcome === "lose" ? (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="text-body text-text-secondary"
                >
                  No match this time
                </motion.span>
              ) : null}
            </div>
          </div>

          <canvas
            ref={canvas}
            width={FOIL_W}
            height={FOIL_H}
            // the coating's own thickness: a shadow inside every hole along the
            // edge above it, and a lit lip along the edge below it
            style={{
              filter:
                "drop-shadow(0 1px 0.6px rgb(0 0 0 / 0.3)) drop-shadow(0 -0.6px 0 rgb(255 255 255 / 0.75))",
            }}
            className="pointer-events-none absolute inset-0 size-full"
          />

          {!isUp ? (
            <button
              type="button"
              onClick={keyScratch}
              aria-disabled={auto || undefined}
              aria-label="Scratch the card. Three of a kind wins."
              className={cn(
                "absolute inset-0 cursor-pointer rounded-[8px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
              )}
            />
          ) : null}
        </div>

        {/* the paper is matte, so it catches the same light as a wide, faint
            bloom where the foil throws back a sharp band */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_var(--lx,32%)_var(--ly,38%),rgb(255_255_255/0.5),transparent_65%)] mix-blend-soft-light"
        />
        {/* a press sinks the card into the table round the finger, which is a
            shade rather than a shape */}
        <div
          ref={dimple}
          aria-hidden="true"
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_var(--px,50%)_var(--py,50%),rgb(0_0_0/0.07),rgb(0_0_0/0.025)_2.5rem,transparent_5.5rem)] mix-blend-multiply transition-opacity duration-200"
        />
      </motion.div>

      <span role="status" className="sr-only">
        {outcome === "win" && card.win
          ? `Three of a kind. You won ${PRIZES[card.win]}. Your code is ${card.code}.`
          : outcome === "lose"
            ? "No match this time."
            : ""}
      </span>
    </div>
  );
}

/**
 * The code, printed raised on the strip, and the button that copies it. The
 * print's highlight and shadow fall on the side the card leans away from, off
 * the tilt the face writes as `--tx` and `--ty`.
 */
function CodeButton({
  ref,
  code,
  copied,
  onCopy,
  glint,
}: {
  ref: React.Ref<HTMLButtonElement>;
  code: string;
  copied: boolean;
  onCopy: () => void;
  /** which side the glint crosses from, which is the side the light is on */
  glint: "left" | "right" | null;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Code copied" : `Copy code ${code}`}
      className={cn(
        "group relative inline-flex cursor-pointer items-center rounded-md px-2 py-0.5 text-text-primary transition-all duration-200",
        "hover:bg-fill active:bg-fill-hover active:duration-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      )}
    >
      {/* the code and its glint share a clip, so the glint cannot leave the
          code's own box. The icon sits outside it. */}
      <span className="relative overflow-hidden">
        <code
          style={{
            textShadow: [
              "calc(var(--tx, 0) * -0.7px) calc(var(--ty, 0) * -0.7px - 0.6px) 0 rgb(255 255 255 / 0.95)",
              "calc(var(--tx, 0) * 0.9px) calc(var(--ty, 0) * 0.9px + 0.9px) 1px rgb(0 0 0 / 0.18)",
            ].join(", "),
          }}
          className="block font-mono text-[clamp(0.85rem,6cqw,1.3rem)] leading-none tracking-[0.06em]"
        >
          {code}
        </code>
        {glint ? (
          <motion.span
            aria-hidden="true"
            initial={{ x: glint === "left" ? "-130%" : "330%" }}
            animate={{ x: glint === "left" ? "330%" : "-130%" }}
            transition={{ duration: 0.75, delay: 0.12, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/85 to-transparent"
          />
        ) : null}
      </span>
      {/*
       * The copy mark is hidden until the code is pointed at, and then slides
       * out of the code's right edge. It hangs outside the pill rather than in
       * it, so the code stays centred. The wrapper clips, so the mark emerges
       * from that edge rather than fading in over the last character. A copied
       * tick stays out until it has gone back to the mark. A device with no
       * hover shows it all the time, since nothing would ever bring it out.
       */}
      <span className="-translate-y-1/2 absolute top-1/2 left-full ml-1 overflow-hidden p-0.5">
        <span
          className={cn(
            "block text-text-muted transition-[translate,opacity] duration-150 ease-[cubic-bezier(0.4,0,1,1)]",
            "group-hover:duration-200 group-hover:ease-[cubic-bezier(0.23,1,0.32,1)] group-focus-visible:duration-200 group-focus-visible:ease-[cubic-bezier(0.23,1,0.32,1)]",
            "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            "[@media(hover:none)]:translate-x-0 [@media(hover:none)]:opacity-100",
            copied
              ? "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0",
          )}
        >
          <CopyMark mark="copy" copied={copied} />
        </span>
      </span>
    </button>
  );
}
