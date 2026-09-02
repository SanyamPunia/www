"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { approach } from "@/lib/lerp";
import { STICKERS } from "./motifs";
import {
  ARM,
  add,
  BOX,
  dot,
  type Fold,
  foldAlong,
  MAX_PULL,
  MIN_PEEL,
  RELEASE,
  spin,
  sub,
  times,
  unit,
  type Vec,
} from "./peel";
import { type Paint, Sticker } from "./sticker";

/*
 * Five stickers loose on a board. Press one and pull, and it peels: the paper
 * under your hand folds back over the rest of itself and what is on top is its
 * own backing. Keep pulling and the last of it lets go, after which it follows
 * you with the fold trailing behind, and it lies down flat wherever it is
 * dropped.
 *
 * The fold is not an animation. A gesture picks one peeling edge and then only
 * advances it: `pull` is the vector the hand is asking for, and what reaches the
 * crease is its component along that edge. While a sticker is stuck that vector
 * is how far the hand has dragged, so the crease sweeps in. Once it is off the
 * board it is the body's own lag behind the hand. Once it is let go it is
 * nothing, and the flap lies back down.
 */

/** the stage's own shape, wide enough to scatter five without a row appearing */
const STAGE_ASPECT = 1.55;

/**
 * How quickly the body follows the hand, and how quickly the fold follows what
 * it is asked for, as time constants in seconds.
 *
 * The body is the slower of the two on purpose. A fold that closed faster than
 * the sticker travels would be flat before it arrived, and the whole of the
 * carry would be a rectangle sliding about.
 *
 * The fold is eased rather than set, even while the hand is on it, which is the
 * one place this stops being geometry. Adhesive gives way, it does not teleport,
 * and at 45ms the crease is a frame or two behind a fast drag and exactly on a
 * slow one. It is also what keeps the moment a sticker comes free from being a
 * jump, since the same value simply stops being the pull and starts being the
 * lag.
 */
const TAU_BODY = 0.075;
const TAU_FOLD = 0.045;

/** how far an arrow key carries a sticker, as a share of the stage's width */
const STEP = 0.065;

/**
 * The fold a sticker keeps once it is off the board, in its own units.
 *
 * The peel that pulls a sticker off is bigger than the peel it carries, because
 * the paper is free to relax the moment nothing is holding it down. Without a
 * floor under it the carried curl is the drag's own lag, which goes to nothing
 * every time the hand turns a corner, and a flap that shuts and opens on every
 * turn is the thing a frozen peeling edge was for.
 */
const CARRY = 40;

/** how far a sticker's middle stays inside the board, as a share of its width */
const INSET = 0.42;

/** the gap inside which the loop calls a sticker settled, in board pixels */
const REST = 0.15;

const ARROWS: Record<string, Vec> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

interface Body {
  /** where it is stuck, in board pixels */
  base: Vec;
  /** where it is now */
  pos: Vec;
  /** the vector the hand is asking for, in board pixels */
  pull: Vec;
  /** the edge that is peeling, in the sticker's own frame, picked once a gesture */
  edge: Vec | null;
  /** how far that edge has been carried, in the sticker's own units */
  peel: number;
  /** where the press landed, in board pixels, which the stuck pull is measured from */
  origin: Vec;
  /** that same point in the sticker's own units, so a carry keeps its grip */
  press: Vec;
  /** off the board and following the hand */
  free: boolean;
  /** carrying its own shadow, which outlasts `free` by the length of the landing */
  lifted: boolean;
  /** where it was peeled from, while it is up */
  from: Vec | null;
}

interface Board {
  width: number;
  height: number;
}

function clampBase(at: Vec, size: number, board: Board): Vec {
  const pad = size * INSET;
  return {
    x: Math.max(pad, Math.min(board.width - pad, at.x)),
    y: Math.max(pad, Math.min(board.height - pad, at.y)),
  };
}

function toward(from: Vec, to: Vec, k: number): Vec {
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}

export default function StickerPeel() {
  const [stage, setStage] = useState<Board>({ width: 0, height: 0 });
  /* The pile order, and the only state in this experiment: a press puts one
     sticker on top, and nothing else here renders at all. */
  const [order, setOrder] = useState(() => STICKERS.map((_, i) => i));

  const boardRef = useRef<HTMLDivElement>(null);
  const paints = useRef<Paint[]>([]);
  const bodies = useRef<Body[]>([]);
  const board = useRef<Board>({ width: 0, height: 0 });

  const held = useRef<number | null>(null);
  /** the hand in client coordinates, turned into board ones once per frame */
  const client = useRef<Vec>({ x: 0, y: 0 });
  const hand = useRef<Vec>({ x: 0, y: 0 });

  const frame = useRef(0);
  const last = useRef(0);
  const reduce = useReducedMotion();
  const instant = useRef(false);
  instant.current = !!reduce;

  const tick = useCallback(function tick(now: number) {
    const node = boardRef.current;
    const size = board.current;
    if (!node || bodies.current.length === 0) {
      frame.current = 0;
      return;
    }

    const dt = last.current
      ? Math.min((now - last.current) / 1000, 0.05)
      : 1 / 60;
    last.current = now;

    /*
     * One rect read a frame, at the top, before anything is written. The board
     * scrolls with the page while a drag is running, so the offset cannot be
     * measured once at the press, and reading it after the frame's writes is
     * what turns a cheap read into a forced reflow.
     */
    if (held.current !== null) {
      const rect = node.getBoundingClientRect();
      hand.current = {
        x: client.current.x - rect.left,
        y: client.current.y - rect.top,
      };
    }

    const kBody = instant.current ? 1 : approach(TAU_BODY, dt);
    const kFold = instant.current ? 1 : approach(TAU_FOLD, dt);
    let busy = false;

    bodies.current.forEach((body, index) => {
      const def = STICKERS[index];
      const width = def.size * size.height;
      const px = width / BOX;
      const carried = held.current === index;

      /*
       * What the pull is asked to become, and it is one idea with one exception.
       *
       * A sticker that is travelling wants the distance it still has to cover,
       * so the crease is whatever the body is behind by. That covers a carry, a
       * landing and an arrow key without knowing which of the three it is, and
       * it is why holding an arrow down builds a real peel: the target keeps
       * running ahead of the body, so the lag stops being a flick and becomes a
       * pull.
       *
       * The exception is a sticker that is still stuck, which cannot travel at
       * all. There the pull is the hand's own distance from the press, so the
       * crease is the only thing that can give.
       */
      let want: Vec;

      if (carried && !body.free) {
        want = sub(hand.current, body.origin);
      } else {
        if (carried) {
          // the sticker keeps the grip it was picked up by, so it does not jump
          // under the hand at the moment the adhesive gives
          const aim = sub(hand.current, spin(times(body.press, px), def.angle));
          body.base = clampBase(aim, width, size);
        }
        want = sub(body.base, body.pos);
      }

      body.pull = toward(body.pull, want, kFold);
      body.pos = toward(body.pos, body.base, kBody);

      const local = times(spin(body.pull, -def.angle), 1 / px);

      /*
       * The peeling edge is picked once and then held for the rest of the
       * gesture, which is the difference between a sticker and a trick.
       *
       * Deriving it from the pull every frame is the obvious build and it is
       * what a first version does. It is also wrong in the way that matters: a
       * sticker carried across the board turns as the hand does, and with the
       * edge following the pull the lifted corner jumps from one side of the
       * sticker to another every time the drag changes direction. A corner that
       * has come up has come up.
       */
      if (!body.edge) body.edge = unit(local, ARM);

      /*
       * Which leaves one number moving. What reaches the crease is the pull's
       * own component along that edge, so a drag that veers off it advances the
       * peel more slowly and one that comes back does not advance it at all.
       */
      const demand = body.edge
        ? Math.min(Math.max(dot(local, body.edge), 0), MAX_PULL)
        : 0;

      /*
       * Which way that number may move is the last of it, and it is three lines
       * because a peel is three situations.
       *
       * Stuck under a hand it only opens, since adhesive does not re-stick when
       * a hand relaxes. Off the board under a hand the paper is free to relax,
       * so it eases to the carried fold or to whatever the drag is adding,
       * whichever is more. Let go, it eases shut.
       */
      if (carried && !body.free) {
        if (demand > body.peel) body.peel = demand;
      } else {
        const want = Math.max(demand, carried ? CARRY : 0);
        body.peel += (want - body.peel) * kFold;
      }

      // the last of the adhesive letting go
      if (carried && !body.free && body.peel > RELEASE) {
        body.free = true;
        body.lifted = true;
      }

      const still =
        Math.hypot(body.base.x - body.pos.x, body.base.y - body.pos.y) < REST &&
        body.peel < MIN_PEEL;

      let fold: Fold | null = body.edge
        ? foldAlong(body.edge, body.peel)
        : null;

      if (carried || !still) {
        busy = true;
      } else {
        // an exponential approach never lands, so it is snapped inside the
        // epsilon rather than given one more frame it cannot use
        body.pos = { ...body.base };
        body.pull = { x: 0, y: 0 };
        body.peel = 0;
        body.edge = null;
        body.lifted = false;
        fold = null;
      }

      paints.current[index]?.({
        pos: body.pos,
        size: width,
        fold,
        from: body.from,
        lifted: body.lifted,
      });
    });

    if (busy) {
      frame.current = requestAnimationFrame(tick);
    } else {
      frame.current = 0;
      last.current = 0;
    }
  }, []);

  /*
   * Cancel and reschedule rather than skipping the request while a handle is
   * set, which is `book-opening`'s call and for its reason: a frame that was
   * scheduled and never arrived would leave every later press writing a target
   * nothing reads.
   */
  const wake = useCallback(() => {
    if (frame.current === 0) last.current = 0;
    else cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) =>
      setStage({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /*
   * The scatter, and what a resize does to an arrangement someone has made.
   *
   * The bodies are kept in board pixels, since that is what every frame reads,
   * so a resize rescales them rather than re-seeding. Putting five stickers
   * back where they started because a window was dragged wider is the one thing
   * this cannot do.
   */
  useEffect(() => {
    if (stage.width === 0 || stage.height === 0) return;
    const was = board.current;
    board.current = stage;

    if (bodies.current.length === 0) {
      bodies.current = STICKERS.map((def) => {
        const at = { x: def.at.x * stage.width, y: def.at.y * stage.height };
        return {
          base: at,
          pos: { ...at },
          pull: { x: 0, y: 0 },
          edge: null,
          peel: 0,
          origin: { ...at },
          press: { x: 0, y: 0 },
          free: false,
          lifted: false,
          from: null,
        };
      });
    } else if (was.width > 0) {
      const kx = stage.width / was.width;
      const ky = stage.height / was.height;
      for (const body of bodies.current) {
        for (const point of [body.base, body.pos, body.origin]) {
          point.x *= kx;
          point.y *= ky;
        }
      }
    }

    wake();
  }, [stage, wake]);

  /* Returning the same array when a sticker is already on top is what keeps key
     repeat from rendering thirty times a second for no change. */
  const bringToTop = useCallback((index: number) => {
    setOrder((pile) =>
      pile[pile.length - 1] === index
        ? pile
        : [...pile.filter((n) => n !== index), index],
    );
  }, []);

  const onGrab = useCallback(
    (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
      const node = boardRef.current;
      const body = bodies.current[index];
      if (!node || !body || held.current !== null) return;

      const def = STICKERS[index];
      const px = (def.size * board.current.height) / BOX;
      const rect = node.getBoundingClientRect();
      const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      /* The press is remembered twice. `origin` is what the stuck pull is
         measured from, and `press` is the same point in the sticker's own
         units, which is the grip a carry keeps so the sticker does not jump
         once it comes free. Neither decides where the peel starts: that is the
         edge the pull is coming from, and `peel.ts` derives it. */
      body.origin = at;
      body.press = times(spin(sub(at, body.pos), -def.angle), 1 / px);
      body.pull = { x: 0, y: 0 };
      body.peel = 0;
      body.edge = null;
      body.free = false;
      body.from = { ...body.pos };

      held.current = index;
      client.current = { x: event.clientX, y: event.clientY };
      hand.current = at;

      /* the board keeps the pointer, so a hand that runs off the sticker, or
         off the frame, is still the hand carrying it */
      node.setPointerCapture(event.pointerId);
      node.dataset.dragging = "true";
      bringToTop(index);
      wake();
    },
    [wake, bringToTop],
  );

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (held.current === null) return;
      client.current = { x: event.clientX, y: event.clientY };
      wake();
    },
    [wake],
  );

  /*
   * Letting go does not put the sticker anywhere. It stops feeding the hand,
   * after which the body finishes arriving where it was already heading and the
   * flap closes over it as it lands, which is one movement rather than a drop
   * and then an unfold.
   */
  const onRelease = useCallback(() => {
    const index = held.current;
    if (index === null) return;

    const body = bodies.current[index];
    body.free = false;
    body.from = null;
    held.current = null;

    if (boardRef.current) boardRef.current.dataset.dragging = "false";
    wake();
  }, [wake]);

  const onKey = useCallback(
    (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
      const dir = ARROWS[event.key];
      const body = bodies.current[index];
      if (!dir || !body || held.current !== null) return;
      event.preventDefault();

      const def = STICKERS[index];
      const size = board.current;
      const width = def.size * size.height;
      const move = times(dir, STEP * size.width);

      /*
       * A key press only sends the sticker somewhere. The peel is the loop's,
       * off the lag that opens between the target and the body, which is the
       * same vector a carried sticker curls by. So a tap of an arrow gets the
       * curl a short drag gets, and holding one down gets the curl of a long
       * one, without a second path through this file.
       */
      body.base = clampBase(add(body.base, move), width, size);
      body.free = false;
      body.lifted = true;
      bringToTop(index);
      wake();
    },
    [wake, bringToTop],
  );

  return (
    <div
      ref={boardRef}
      onPointerMove={onMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      data-dragging="false"
      /*
       * A light board, which is the point of this one. Four experiments before
       * it had to invert their ground because the object was paper and the page
       * is white. Here the objects are printed vinyl and the only white on them
       * is the die cut, which carries its own hairline, so the board can be the
       * quiet `fill` `folder-stack` uses and the site stays light.
       *
       * The radius is `Demo`'s own, since `flush` means the two are one box, and
       * the clip is what stops a flap carried to the edge painting past it.
       */
      className="relative w-full touch-pan-y select-none overflow-hidden rounded-lg bg-fill data-[dragging=true]:cursor-grabbing data-[dragging=true]:[&_*]:cursor-grabbing"
      style={{
        aspectRatio: STAGE_ASPECT,
        /* A printed board rather than a flat fill. It is texture and not
           information, and what it buys is that every white edge on a sticker
           reads by interrupting it rather than by its own tone. */
        backgroundImage:
          "radial-gradient(circle at 1px 1px, var(--color-stroke-strong) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }}
    >
      {stage.height > 0 &&
        STICKERS.map((def, index) => (
          <Sticker
            key={def.id}
            def={def}
            index={index}
            size={def.size * stage.height}
            z={10 + order.indexOf(index)}
            paints={paints}
            onGrab={onGrab}
            onKey={onKey}
          />
        ))}
    </div>
  );
}
