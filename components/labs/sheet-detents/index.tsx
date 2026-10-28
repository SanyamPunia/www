"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  CherriesIcon,
  ClockIcon,
  CloverIcon,
  FlameIcon,
  HeartIcon,
  type IconComponent,
  ImageIcon,
  MagnifyingGlassIcon,
  NoteIcon,
  PlayIcon,
  StarIcon,
  SunIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TownMap } from "./map";
import {
  distance,
  FAVOURITES,
  type Glyph,
  matches,
  NEARBY,
  PLACES,
  type Place,
  placeById,
  WORLD,
  YOU,
} from "./places";
import {
  band,
  DETENT_LABEL,
  DETENTS,
  type Detent,
  detentY,
  FULL_TOP,
  level,
  nearest,
  rubberband,
  SLOP,
  settle,
  unbandY,
  unit,
} from "./sheet";
import { armSound, buzz, land, pop, tick } from "./sheet-sound";

/*
 * An iOS bottom sheet with three detents, over a map. `sheet.ts` is the
 * numbers, `places.ts` what is on the map, `map.tsx` the town and
 * `sheet-sound.ts` the sounds. This file is the screen, the gesture and the
 * scroll handoff.
 *
 * **The sheet is one value, `y`, and everything on the screen reads it.** The
 * map's push back, the scrim, the sheet's top corners, the favourites
 * fading in and where the map keeps its centre are all transforms of it, so
 * nothing renders while the sheet moves.
 *
 * **One gesture owns either the sheet or the list, and hands over without a
 * seam.** A drag up on a sheet below full moves the sheet, and once the sheet
 * reaches full the rest of the same drag scrolls the list. A drag down on a
 * list scrolled to its top moves the sheet. The list is scrolled by hand rather
 * than natively, since a native scroll cannot hand its remaining travel to
 * something else mid-gesture.
 */

/** the screen's own corner, which the pushed-back map's corners start from */
const SCREEN_R = 32;

/** how much of its size the map gives up at full */
const BACK = 0.075;

/** a wheel gesture has ended once no event has come for this long */
const WHEEL_IDLE_MS = 120;

/** UIScrollView's normal deceleration, as a time constant */
const COAST_TAU = 0.325;

/** near critical, so a throw lands with the faintest settle */
const SPRING = { type: "spring", stiffness: 380, damping: 36 } as const;

/** the map gliding to a place */
const PAN = { type: "spring", visualDuration: 0.6, bounce: 0 } as const;

const GLYPH: Record<Glyph, IconComponent> = {
  heart: HeartIcon,
  sun: SunIcon,
  cherries: CherriesIcon,
  image: ImageIcon,
  clover: CloverIcon,
  play: PlayIcon,
  note: NoteIcon,
  flame: FlameIcon,
  star: StarIcon,
  clock: ClockIcon,
};

type Owner = "sheet" | "list";

/** one gesture: a pointer drag or a wheel run, routed through the same code */
interface Gesture {
  owner: Owner;
  /** the sheet's position before the rubber band */
  raw: number;
  /** the list's offset before the rubber band */
  rawS: number;
  /** started on the header, so pushing up past full never scrolls the list */
  header: boolean;
  /**
   * Whether the list may hand a downward pull to the sheet. Always for a hand,
   * and for a wheel only when its run began with the list at its top, or a
   * fling's momentum arriving at the top would drag the sheet down with it.
   */
  down: boolean;
}

interface Drag extends Gesture {
  pointer: number;
  x0: number;
  y0: number;
  last: number;
  live: boolean;
}

/** the last 80ms of motion, for a release velocity */
type Sample = [t: number, v: number];

function velocityOf(samples: Sample[]): number {
  const now = performance.now();
  const recent = samples.filter(([t]) => now - t < 80);
  if (recent.length < 2) return 0;
  const [t0, v0] = recent[0];
  const [t1, v1] = recent[recent.length - 1];
  return t1 > t0 ? ((v1 - v0) / (t1 - t0)) * 1000 : 0;
}

function push(samples: Sample[], v: number) {
  samples.push([performance.now(), v]);
  if (samples.length > 12) samples.shift();
}

export default function SheetDetents() {
  const stage = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion() ?? false;

  /** the screen's size, as values so the transforms answer a resize */
  const W = useMotionValue(320);
  const H = useMotionValue(416);
  const geo = useRef({ w: 320, h: 416, header: 58, max: 0 });

  const y = useMotionValue(detentY("half", 416));
  const scroll = useMotionValue(0);
  const fx = useMotionValue<number>(YOU.x);
  const fy = useMotionValue<number>(YOU.y);

  const [detent, setDetentState] = useState<Detent>("half");
  const detentRef = useRef<Detent>("half");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const drag = useRef<Drag | null>(null);
  const wheel = useRef<
    Gesture & { lastAt: number; timer: number; active: boolean; step: number }
  >({
    owner: "sheet",
    raw: 0,
    rawS: 0,
    header: false,
    down: true,
    lastAt: 0,
    timer: 0,
    active: false,
    step: 0,
  });
  const ySamples = useRef<Sample[]>([]);
  const sSamples = useRef<Sample[]>([]);
  const coastFrame = useRef(0);
  /** a press that only caught a coasting list, or ended a drag, is not a tap */
  const swallow = useRef(false);
  const peeked = useRef(false);

  /* -------------------------------------------------------- the derived */

  const lvl = useTransform([y, H], ([v, h]: number[]) => level(v, h));
  /** 0 below half, 1 at full: how far the sheet has gone past half */
  const past = useTransform(lvl, (l) => unit(l - 1));

  /*
   * The sheet runs to the screen's sides and foot at every detent, and only
   * its top corners answer the sheet: they tighten from 20px to 12px past
   * half. The box is the screen's height and runs off its foot, so the clip's
   * bottom edge is however much of it is below the screen. The screen's own
   * corners round the foot.
   */
  const clip = useTransform([y, past], ([v, s]: number[]) => {
    const top = 20 - 8 * s;
    return `inset(0px 0px ${v}px 0px round ${top}px ${top}px 0px 0px)`;
  });

  // the map is pushed back as the sheet passes half, the way a page sheet
  // pushes back what it covers
  /*
   * The pushed-back map stays concentric with the screen. Scaling about its
   * top centre leaves a gap at each side of half the width it lost, so it
   * drops by that same gap and the gap is even on three sides. Its painted
   * corner is then the screen's corner less the gap, and the radius is set
   * before the scale, so it is divided back out. At full on a 320px screen:
   * a 12px gap and a 20px corner inside the screen's 32px.
   */
  const backScale = useTransform(past, (s) => 1 - BACK * s);
  const backGap = useTransform(
    [past, W],
    ([s, w]: number[]) => (BACK * s * w) / 2,
  );
  const backR = useTransform(
    [backGap, backScale],
    ([gap, scale]: number[]) => (SCREEN_R - gap) / scale,
  );
  const scrim = useTransform(past, (s) => 0.3 * s);
  const controls = useTransform(lvl, (l) => 1 - unit((l - 1) / 0.45));

  /*
   * The map keeps its centre in the part of the screen the sheet leaves
   * uncovered. Below half that part grows and shrinks with the sheet, so the
   * map moves at half the sheet's speed. Above half the sheet covers it
   * anyway, so the centre stops where half put it.
   */
  const mapX = useTransform([fx, W], ([f, w]: number[]) => w / 2 - f);
  const mapY = useTransform([fy, y, H], ([f, v, h]: number[]) => {
    const open = Math.min(Math.max(v, detentY("half", h)), detentY("peek", h));
    return open / 2 - f;
  });

  const favOpacity = useTransform(lvl, (l) => unit((l - 0.15) / 0.7));
  const favY = useTransform(favOpacity, (o) => 8 * (1 - o));
  const listY = useTransform(scroll, (s) => -s);
  const rule = useTransform(scroll, [0, 10], [0, 1]);

  /* --------------------------------------------------------- measuring */

  const measure = useCallback(() => {
    const el = screen.current;
    const hd = header.current;
    const bd = body.current;
    if (!el || !hd || !bd) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const was = geo.current.h;
    geo.current.w = w;
    geo.current.h = h;
    geo.current.header = hd.offsetHeight;
    // the list's room at full: the screen less the gap above the sheet and
    // the header
    const room = h - FULL_TOP - hd.offsetHeight;
    geo.current.max = Math.max(0, bd.offsetHeight - room);
    W.set(w);
    H.set(h);
    // a corrected measurement is set, never animated, `gooey-chips`'s rule
    if (was !== h) {
      y.jump(detentY(detentRef.current, h));
    }
    if (scroll.get() > geo.current.max) scroll.jump(geo.current.max);
  }, [H, W, scroll, y]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (screen.current) ro.observe(screen.current);
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, [measure]);

  /* ------------------------------------------------------- the sheet */

  const setDetent = useCallback((d: Detent) => {
    detentRef.current = d;
    setDetentState(d);
  }, []);

  const stopCoast = useCallback(() => {
    cancelAnimationFrame(coastFrame.current);
    coastFrame.current = 0;
  }, []);

  /**
   * Send the sheet to a detent. A release passes its own speed in, so the
   * spring leaves at the hand's speed and there is no seam. The thud plays
   * when the sheet arrives, not when the spring's long tail ends.
   */
  const goTo = useCallback(
    (d: Detent, velocity = 0) => {
      const h = geo.current.h;
      const to = detentY(d, h);
      const from = y.get();
      setDetent(d);
      setMessage(`${DETENT_LABEL[d]}.`);
      // a sheet leaving full takes its list back to the top, the way Maps does
      if (d !== "full" && scroll.get() !== 0) {
        stopCoast();
        if (reduce) scroll.set(0);
        else animate(scroll, 0, SPRING);
      }
      if (reduce) {
        y.set(to);
        if (Math.abs(from - to) > 1) land(600);
        return;
      }
      const speed = Math.max(Math.abs(velocity), Math.abs(to - from) * 3);
      let landed = Math.abs(from - to) < 1;
      animate(y, to, {
        ...SPRING,
        velocity,
        onUpdate: (v) => {
          if (!landed && Math.abs(v - to) < 1.5) {
            landed = true;
            land(speed);
            buzz(8);
          }
        },
      });
    },
    [reduce, scroll, setDetent, stopCoast, y],
  );

  /** a step up or down the detents, for the keys and a mouse wheel's notch */
  const stepBy = useCallback(
    (by: 1 | -1) => {
      const i = DETENTS.indexOf(detentRef.current);
      const j = Math.min(DETENTS.length - 1, Math.max(0, i + by));
      if (j !== i) goTo(DETENTS[j]);
    },
    [goTo],
  );

  /** the sheet's position from a hand, ticking as it crosses a detent */
  const moveSheet = useCallback(
    (raw: number) => {
      const h = geo.current.h;
      const before = y.get();
      const after = band(raw, h);
      for (const d of DETENTS) {
        const line = detentY(d, h);
        if ((before - line) * (after - line) < 0) {
          tick(after < before);
          buzz(4);
        }
      }
      y.set(after);
      push(ySamples.current, after);
    },
    [y],
  );

  const moveList = useCallback(
    (rawS: number) => {
      const { max, h, header: hd } = geo.current;
      const room = h - FULL_TOP - hd;
      const s = rawS > max ? max + rubberband(rawS - max, room) : rawS;
      scroll.set(s);
      push(sSamples.current, s);
    },
    [scroll],
  );

  /**
   * One step of a gesture, `dy` positive for a hand moving down. This is the
   * handoff: whatever one owner cannot use goes to the other in the same step,
   * so the move that brings the sheet to full and the move that starts the
   * list scrolling are one move.
   */
  const route = useCallback(
    (g: Gesture, dy: number) => {
      const top = detentY("full", geo.current.h);
      if (g.owner === "sheet") {
        g.raw += dy;
        if (dy < 0 && g.raw < top && !g.header && geo.current.max > 0) {
          const over = top - g.raw;
          g.raw = top;
          moveSheet(top);
          g.owner = "list";
          g.rawS = scroll.get() + over;
          moveList(g.rawS);
          if (detentRef.current !== "full") setDetent("full");
          return;
        }
        moveSheet(g.raw);
        return;
      }
      g.rawS -= dy;
      if (g.rawS < 0) {
        if (!g.down) {
          g.rawS = 0;
          moveList(0);
          return;
        }
        const over = -g.rawS;
        g.rawS = 0;
        moveList(0);
        g.owner = "sheet";
        g.raw = top + over;
        moveSheet(g.raw);
        return;
      }
      moveList(g.rawS);
    },
    [moveList, moveSheet, scroll, setDetent],
  );

  /**
   * A list let go keeps going, decaying like a scroll view, and springs off
   * either end with the speed it reached it at.
   */
  const coast = useCallback(
    (velocity: number) => {
      stopCoast();
      const { max } = geo.current;
      const s0 = scroll.get();
      if (s0 > max || s0 < 0) {
        animate(scroll, Math.min(max, Math.max(0, s0)), {
          ...SPRING,
          velocity,
        });
        return;
      }
      if (reduce || Math.abs(velocity) < 40) return;
      let v = velocity;
      let last = performance.now();
      const frame = (t: number) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        v *= Math.exp(-dt / COAST_TAU);
        const s = scroll.get() + v * dt;
        if (s < 0 || s > max) {
          coastFrame.current = 0;
          animate(scroll, s < 0 ? 0 : max, { ...SPRING, velocity: v });
          return;
        }
        scroll.set(s);
        if (Math.abs(v) < 12) {
          coastFrame.current = 0;
          return;
        }
        coastFrame.current = requestAnimationFrame(frame);
      };
      coastFrame.current = requestAnimationFrame(frame);
    },
    [reduce, scroll, stopCoast],
  );

  /** a gesture let go: the owner decides where things rest */
  const release = useCallback(
    (g: Gesture) => {
      if (g.owner === "list") {
        coast(velocityOf(sSamples.current));
        return;
      }
      const v = velocityOf(ySamples.current);
      const h = geo.current.h;
      goTo(settle(y.get(), v, h, nearest(y.get(), h)), v);
    },
    [coast, goTo, y],
  );

  /** a fresh gesture: stop what is moving and decide who owns it */
  const begin = useCallback(
    (g: Gesture, onHeader: boolean) => {
      stopCoast();
      y.stop();
      scroll.stop();
      ySamples.current = [];
      sSamples.current = [];
      const h = geo.current.h;
      const atFull = Math.abs(y.get() - detentY("full", h)) < 2;
      g.header = onHeader;
      g.owner = atFull && !onHeader && geo.current.max > 0 ? "list" : "sheet";
      g.raw = unbandY(y.get(), h);
      g.rawS = scroll.get();
    },
    [scroll, stopCoast, y],
  );

  /* -------------------------------------------------------- the hand */

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return;
    armSound();
    // a press on a moving sheet or list catches it, and is not also a tap.
    // Moving means visibly away from where it is going: a spring's tail spends
    // most of a second on fractions of a pixel, and a tap there is a tap
    const off = Math.abs(y.get() - detentY(detentRef.current, geo.current.h));
    const s0 = scroll.get();
    swallow.current =
      coastFrame.current !== 0 ||
      off > 2 ||
      s0 < -1 ||
      s0 > geo.current.max + 1;
    const g: Drag = {
      pointer: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      last: e.clientY,
      live: false,
      owner: "sheet",
      raw: 0,
      rawS: 0,
      header: false,
      down: true,
    };
    begin(g, !!header.current?.contains(e.target as Node));
    drag.current = g;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.live) {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) < SLOP) return;
      g.live = true;
      swallow.current = true;
      // no capture before now: a press that never moves is a tap, and a
      // capture would send its click to the sheet instead of the row
      e.currentTarget.setPointerCapture(e.pointerId);
      if (stage.current) stage.current.dataset.carry = "true";
      if (document.activeElement === input.current) input.current?.blur();
      // the slop is spent rather than applied, so the drag starts here
      g.last = e.clientY;
      return;
    }
    const dy = e.clientY - g.last;
    g.last = e.clientY;
    route(g, dy);
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.pointer) return;
    drag.current = null;
    if (stage.current) stage.current.dataset.carry = "false";
    if (g.live) {
      release(g);
      return;
    }
    // a press that caught something mid-flight lets it finish: a sheet goes
    // to its nearest detent and a list off either end springs back
    const h = geo.current.h;
    const d = nearest(y.get(), h);
    if (Math.abs(y.get() - detentY(d, h)) > 0.5) goTo(d);
    coast(0);
  };

  /* ------------------------------------------- the wheel and trackpad */

  useEffect(() => {
    const el = stage.current?.querySelector<HTMLElement>("[data-sheet]");
    if (!el) return;
    const w = wheel.current;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = e.deltaY * scale;
      if (Math.abs(dy) < Math.abs(e.deltaX)) return;
      const now = performance.now();
      const h = geo.current.h;
      const atFull = Math.abs(y.get() - detentY("full", h)) < 2;
      const fresh = now - w.lastAt > 160;

      // a mouse notch moves one detent, or scrolls the list a notch at full
      const notch = e.deltaMode !== 0 || (Math.abs(dy) >= 50 && fresh);
      if (notch && !w.active) {
        const listCan =
          atFull &&
          ((dy > 0 && scroll.get() < geo.current.max) ||
            (dy < 0 && scroll.get() > 0));
        if (listCan) {
          e.preventDefault();
          const to = Math.min(geo.current.max, Math.max(0, scroll.get() + dy));
          if (reduce) scroll.set(to);
          else animate(scroll, to, SPRING);
          w.lastAt = now;
          return;
        }
        const i = DETENTS.indexOf(detentRef.current);
        const j = i + (dy > 0 ? 1 : -1);
        if (j < 0 || j >= DETENTS.length) return;
        e.preventDefault();
        if (now - w.step > 160) {
          w.step = now;
          armSound();
          goTo(DETENTS[j]);
        }
        w.lastAt = now;
        return;
      }

      if (fresh) {
        // a run that can only push past an end is the page's, not the sheet's
        const atPeek = detentRef.current === "peek";
        const listEnd = scroll.get() >= geo.current.max - 0.5;
        if ((atPeek && dy < 0) || (atFull && listEnd && dy > 0)) {
          w.lastAt = 0;
          return;
        }
        begin(w, !!header.current?.contains(e.target as Node));
        w.down = scroll.get() <= 0.5;
        w.active = true;
      }
      if (!w.active) return;
      e.preventDefault();
      w.lastAt = now;
      route(w, -dy);
      clearTimeout(w.timer);
      w.timer = window.setTimeout(() => {
        w.active = false;
        release(w);
      }, WHEEL_IDLE_MS);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(w.timer);
    };
  }, [begin, goTo, reduce, release, route, scroll, y]);

  /* ---------------------------------------------------------- places */

  const select = useCallback(
    (p: Place | null) => {
      armSound();
      setSelected(p?.id ?? null);
      const to = p ?? YOU;
      if (reduce) {
        fx.set(to.x);
        fy.set(to.y);
      } else {
        animate(fx, to.x, PAN);
        animate(fy, to.y, PAN);
      }
      // a sheet at full covers the map, so a pick brings it down to show it
      if (detentRef.current === "full") goTo("half");
      if (p) {
        pop();
        buzz(6);
        setMessage(`${p.name}, ${distance(p)} away.`);
      } else {
        setMessage("Showing your location.");
      }
    },
    [fx, fy, goTo, reduce],
  );

  /**
   * A tap on a row, unless the press was really a drag or a catch. A keyboard
   * activation has no press behind it, which `detail` of 0 says.
   */
  const tap = (fn: () => void) => (e: MouseEvent) => {
    if (e.detail !== 0 && swallow.current) {
      swallow.current = false;
      return;
    }
    fn();
  };

  /** focus moving into the list raises the sheet and keeps the row in view */
  const onListFocus = useCallback(
    (e: globalThis.FocusEvent) => {
      const row = e.target as HTMLElement;
      const bd = body.current;
      // a mouse press focuses a row too, and a press is a pick, not a reach
      if (!bd?.contains(row) || !row.matches(":focus-visible")) return;
      if (detentRef.current !== "full") goTo("full");
      const { h, header: hd, max } = geo.current;
      const room = h - FULL_TOP - hd;
      // both rects carry the list's offset, so their difference is the row's
      // place in the list
      const top =
        row.getBoundingClientRect().top - bd.getBoundingClientRect().top;
      const bottom = top + row.offsetHeight;
      const s = scroll.get();
      let to = s;
      // the margins leave room for the focus ring's offset
      if (bottom > s + room - 12) to = bottom - room + 12;
      if (top < s + 8) to = top - 8;
      to = Math.min(max, Math.max(0, to));
      if (to !== s) {
        if (reduce) scroll.set(to);
        else animate(scroll, to, SPRING);
      }
    },
    [goTo, reduce, scroll],
  );

  // Bound to the node, since the list is a region rather than a control
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    el.addEventListener("focusin", onListFocus);
    return () => el.removeEventListener("focusin", onListFocus);
  }, [onListFocus]);

  /* -------------------------------------------------------------- keys */

  const onGrabberKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowUp: () => stepBy(1),
      ArrowRight: () => stepBy(1),
      PageUp: () => stepBy(1),
      ArrowDown: () => stepBy(-1),
      ArrowLeft: () => stepBy(-1),
      PageDown: () => stepBy(-1),
      Home: () => goTo("peek"),
      End: () => goTo("full"),
      Enter: () => cycle(),
      " ": () => cycle(),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    armSound();
    fn();
  };

  /** a tap on the grabber walks up the detents and wraps back to the peek */
  const cycle = () => {
    const i = DETENTS.indexOf(detentRef.current);
    goTo(DETENTS[(i + 1) % DETENTS.length]);
  };

  // Escape anywhere in the demo clears a search, then lowers the sheet. Bound
  // to the node, since the stage is a region rather than a control
  const queryRef = useRef(query);
  queryRef.current = query;
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.activeElement === input.current && queryRef.current) {
        setQuery("");
        return;
      }
      input.current?.blur();
      if (detentRef.current !== "peek") goTo("peek");
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [goTo]);

  /* ------------------------------------------------------ the first look */

  // the sheet lifts a little and settles the first time it is seen, since a
  // card at rest says nothing about being draggable
  useEffect(() => {
    const el = stage.current;
    if (!el || reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || peeked.current) return;
        peeked.current = true;
        io.disconnect();
        window.setTimeout(() => {
          if (drag.current || wheel.current.active) return;
          const rest = detentY(detentRef.current, geo.current.h);
          animate(y, [rest, rest - 22, rest], {
            duration: 0.9,
            times: [0, 0.35, 1],
            ease: ["easeOut", [0.34, 1.4, 0.64, 1]],
          });
        }, 450);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, y]);

  useEffect(() => () => cancelAnimationFrame(coastFrame.current), []);

  /* ------------------------------------------------------------ render */

  const results = NEARBY.filter((p) => matches(p, query));
  const searching = query.trim().length > 0;
  const index = DETENTS.indexOf(detent);

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div
        ref={stage}
        className={cn(
          "relative flex h-[31rem] w-full select-none flex-col items-center justify-center gap-4 overflow-clip rounded-lg bg-fill",
          "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
        )}
      >
        {/*
         * Every box that clips here is `overflow-clip`, never `hidden`. A
         * hidden overflow is still a scroll container, so focusing a row
         * below the screen's foot scrolled the whole screen up by script and
         * left the map's foot black. A clip cannot be scrolled at all, and
         * the list's own offset is `scroll`.
         */}
        <div
          ref={screen}
          className="relative isolate h-[26rem] w-[min(20rem,calc(100%-2rem))] shrink-0 overflow-clip rounded-[2rem] bg-inverse-bg"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.06), 0 18px 40px -16px rgba(0,0,0,0.28)",
          }}
        >
          {/* the map, which the sheet pushes back once it passes half */}
          <motion.div
            className="absolute inset-0 origin-top overflow-clip"
            style={{ scale: backScale, y: backGap, borderRadius: backR }}
          >
            <motion.div
              className="absolute top-0 left-0"
              style={{ x: mapX, y: mapY, width: WORLD, height: WORLD }}
            >
              <TownMap />
              <You />
              {PLACES.map((p) => (
                <Pin
                  key={p.id}
                  place={p}
                  on={selected === p.id}
                  onSelect={() => select(p)}
                />
              ))}
            </motion.div>

            <motion.div
              className="absolute top-4 right-4"
              style={{ opacity: controls }}
            >
              <Tooltip label="Show my location" side="left">
                <button
                  type="button"
                  aria-label="Show my location"
                  onClick={() => select(null)}
                  className={cn(
                    "grid size-9 cursor-pointer place-items-center rounded-full bg-bg text-text-primary transition-colors duration-150 hover:bg-surface active:bg-fill",
                    "focus-visible:outline-2 focus-visible:outline-text-primary focus-visible:outline-offset-2",
                  )}
                  style={{
                    boxShadow:
                      "0 1px 2px rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,0,0,0.18)",
                  }}
                >
                  <LocateMark on={selected === null} />
                </button>
              </Tooltip>
            </motion.div>

            {/* the scrim, a real button so a press above a full sheet brings
                it back down */}
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => goTo("half")}
              className={cn(
                "absolute inset-0 bg-black",
                detent === "full" ? "cursor-pointer" : "pointer-events-none",
              )}
              style={{ opacity: scrim }}
            />
          </motion.div>

          {/* the sheet. The wrapper casts the shadow, which a drop shadow
              draws round the clip, and carries the move */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 h-full"
            style={{
              y,
              filter:
                "drop-shadow(0 -1px 10px rgba(0,0,0,0.12)) drop-shadow(0 0 1px rgba(0,0,0,0.10))",
            }}
          >
            {/* the clip is the sheet's real edge, and hit testing follows a
                clip, so a press above the sheet reaches the map */}
            <motion.div
              data-sheet=""
              className="pointer-events-auto absolute inset-0 flex touch-none flex-col overflow-clip bg-bg"
              style={{ clipPath: clip }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <div
                ref={header}
                className="relative z-10 shrink-0 cursor-grab bg-bg px-5 pb-3"
              >
                {/* the grabber, which the keyboard drives as a slider */}
                <div className="flex h-5 items-center justify-center">
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Sheet height"
                    aria-orientation="vertical"
                    aria-valuemin={0}
                    aria-valuemax={DETENTS.length - 1}
                    aria-valuenow={index}
                    aria-valuetext={DETENT_LABEL[detent]}
                    onKeyDown={onGrabberKey}
                    onClick={tap(cycle)}
                    className={cn(
                      "group/grab flex h-5 w-14 cursor-pointer items-center justify-center rounded-full",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-9 rounded-full bg-stroke-strong transition-all duration-200 group-hover/grab:w-10 group-hover/grab:bg-text-muted"
                    />
                  </div>
                </div>

                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
                  <input
                    ref={input}
                    type="search"
                    value={query}
                    placeholder="Search places"
                    aria-label="Search places"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      stopCoast();
                      scroll.set(0);
                    }}
                    onClick={tap(() => {
                      if (detentRef.current !== "full") goTo("full");
                    })}
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && detentRef.current !== "full") {
                        goTo("full");
                      }
                    }}
                    className={cn(
                      "h-11 w-full appearance-none rounded-xl bg-fill pr-9 pl-9 text-body text-text-primary outline-none transition-all duration-200 placeholder:text-body placeholder:text-text-muted",
                      "focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                      "[&::-webkit-search-cancel-button]:hidden",
                    )}
                  />
                  {query && (
                    <Tooltip label="Clear search">
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setQuery("");
                          input.current?.focus();
                        }}
                        className={cn(
                          "absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-text-muted transition-colors duration-150 hover:bg-fill-hover hover:text-text-primary active:bg-fill-active",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                        )}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px bg-stroke"
                  style={{ opacity: rule }}
                />
              </div>

              {/* the list, scrolled by hand through `scroll` */}
              <div
                ref={viewport}
                className="relative min-h-0 flex-1 overflow-clip"
              >
                <motion.div ref={body} style={{ y: listY }} className="pb-6">
                  {!searching && (
                    <motion.section
                      aria-label="Favourites"
                      className="px-5 pt-1 pb-3"
                      style={{ opacity: favOpacity, y: favY }}
                    >
                      <h4 className="pb-2 text-meta text-text-muted">
                        Favourites
                      </h4>
                      <div className="grid grid-cols-4 gap-2">
                        {FAVOURITES.map((id) => {
                          const p = placeById(id);
                          if (!p) return null;
                          const Icon = GLYPH[p.glyph];
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-label={p.name}
                              aria-pressed={selected === id}
                              onClick={tap(() => select(p))}
                              className={cn(
                                "group/fav flex cursor-pointer flex-col items-center gap-1.5 rounded-xl py-1.5 transition-colors duration-150 hover:bg-fill active:bg-fill-hover",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                              )}
                            >
                              <span
                                className="grid size-11 place-items-center rounded-full transition-shadow duration-200 group-aria-pressed/fav:ring-2 group-aria-pressed/fav:ring-offset-2"
                                style={
                                  {
                                    backgroundColor: p.hue,
                                    color: "#fff",
                                    "--tw-ring-color": p.hue,
                                  } as CSSProperties
                                }
                              >
                                <Icon className="size-5" />
                              </span>
                              <span className="text-meta text-text-secondary">
                                {p.short}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.section>
                  )}

                  <section aria-label={searching ? "Results" : "Nearby"}>
                    <h4 className="px-5 pt-1 pb-1 text-meta text-text-muted">
                      {searching
                        ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                        : "Nearby"}
                    </h4>
                    {results.length === 0 ? (
                      <p className="px-5 py-6 text-body text-text-muted">
                        No places match that.
                      </p>
                    ) : (
                      <ul>
                        {results.map((p, i) => (
                          <Row
                            key={p.id}
                            place={p}
                            on={selected === p.id}
                            last={i === results.length - 1}
                            onSelect={tap(() => select(p))}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* the detent, in words, under the screen */}
        <span className="whitespace-nowrap text-meta text-text-muted">
          <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
            {DETENT_LABEL[detent]}
          </TextMorph>
        </span>

        <span aria-live="polite" className="sr-only">
          {message}
        </span>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
        />
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------- the parts */

/** a place on the map: a pin with its icon, which says its name when picked */
function Pin({
  place,
  on,
  onSelect,
}: {
  place: Place;
  on: boolean;
  onSelect: (e: MouseEvent) => void;
}) {
  const Icon = GLYPH[place.glyph];
  return (
    <div
      className="absolute"
      style={{ left: place.x, top: place.y, zIndex: on ? 2 : 1 }}
    >
      <Tooltip label={place.name}>
        <button
          type="button"
          aria-label={place.name}
          aria-pressed={on}
          onClick={onSelect}
          className={cn(
            "absolute bottom-0 left-0 flex -translate-x-1/2 cursor-pointer flex-col items-center transition-transform duration-200",
            "focus-visible:outline-2 focus-visible:outline-text-primary focus-visible:outline-offset-2 rounded-full",
            on ? "scale-125" : "hover:scale-110",
          )}
          style={{ transformOrigin: "50% 100%" }}
        >
          <span
            className="grid size-7 place-items-center rounded-full ring-2 ring-bg"
            style={{
              backgroundColor: place.hue,
              color: "#fff",
              boxShadow: "0 2px 6px -1px rgba(0,0,0,0.3)",
            }}
          >
            <Icon className="size-3.5" />
          </span>
          {/* the tail, which is what puts the pin's point on the place */}
          <span
            aria-hidden="true"
            className="-mt-0.5 size-2 rotate-45 rounded-[1px]"
            style={{ backgroundColor: place.hue }}
          />
        </button>
      </Tooltip>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1.5 left-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg px-2 py-0.5 font-medium text-meta text-text-primary transition-all duration-200",
          on ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
        )}
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.16)" }}
      >
        {place.name}
      </span>
    </div>
  );
}

/** the reader: a blue dot with a slow halo */
function You() {
  return (
    <div
      aria-hidden="true"
      className="absolute"
      style={{ left: YOU.x, top: YOU.y }}
    >
      <span
        className="absolute -top-6 -left-6 size-12 rounded-full motion-safe:animate-[you-halo_2.4s_ease-out_infinite]"
        style={{ backgroundColor: "rgba(47,111,214,0.18)" }}
      />
      <span
        className="absolute -top-2 -left-2 size-4 rounded-full ring-3 ring-bg"
        style={{
          backgroundColor: "#2f6fd6",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
    </div>
  );
}

/** the location arrow, filled while the map is on the reader */
function LocateMark({ on }: { on: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="size-4"
    >
      <path
        d="M20 4 4.5 10.6c-.8.3-.7 1.5.1 1.7l6.4 1.2 1.2 6.4c.2.8 1.4.9 1.7.1Z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** one place in the list */
function Row({
  place,
  on,
  last,
  onSelect,
}: {
  place: Place;
  on: boolean;
  last: boolean;
  onSelect: (e: MouseEvent) => void;
}) {
  const Icon = GLYPH[place.glyph];
  return (
    <li className="relative px-2">
      <button
        type="button"
        aria-pressed={on}
        onClick={onSelect}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150",
          on ? "bg-fill" : "hover:bg-fill active:bg-fill-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
        )}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: place.hue, color: "#fff" }}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body text-text-primary">
            {place.name}
          </span>
          <span className="flex items-center gap-1.5 text-meta text-text-muted">
            {place.kind}
            <span
              aria-hidden="true"
              className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
            />
            {distance(place)}
          </span>
        </span>
      </button>
      {!last && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-5 bottom-0 left-16 h-px bg-stroke-soft"
        />
      )}
    </li>
  );
}
