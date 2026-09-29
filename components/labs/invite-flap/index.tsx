"use client";

import { ArrowDownIcon } from "@phosphor-icons/react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { FOCUS } from "@/components/lab/controls";
import { cn } from "@/lib/utils";

/*
 * An invite, sealed under a flap. Press the pill and it flips up over its own
 * top edge like a page of a desk calendar, and what was under it is the code.
 * The flap lands above the code with its back showing, which is the label for
 * what is below it. Press the flap again and it falls back over the code.
 *
 * The flap is one element with two faces, and the code is always mounted
 * under it, so the reveal is occlusion and nothing fades in.
 */

const CODE = "LoveMotion";

/**
 * The one hue in the piece, the reference's green taken down until white type
 * clears 4.5:1 on it: 4.70 under the label, and 4.50 as a graphic on the
 * flap's `surface`. Scoped here, not a token.
 */
const GREEN = "#22844a";

/**
 * One spring for the flap, whatever it is doing. A damping ratio of 0.72, so
 * it goes about seven degrees past its stop and comes back, which is the page
 * landing rather than a box rotating to an angle. A spring rather than a tween,
 * because a press mid-flight turns it round from the speed it already has.
 */
const FLIP = { type: "spring", stiffness: 140, damping: 17 } as const;
/** the pair recentring as the flap opens, with no overshoot of its own */
const SHIFT = { type: "spring", stiffness: 240, damping: 32 } as const;

/**
 * A pointer on the shut flap picks at its corner: the flap tips and rises
 * off the code until the dots show under its foot. The tip alone reveals
 * nothing, because the foot comes toward the eye as it turns and the
 * perspective grows it by as much as the turn lifts it, so the rise is a
 * translate of its own. A sharp tween rather than the flip's spring, since a
 * spring spends most of a move this short creeping over its last pixel,
 * which is the lag `stamp-collection` documents for its own hover.
 */
const PEEK = { tip: 9, rise: 0.12 } as const;
const PEEK_EASE = {
  duration: 0.2,
  ease: [0.23, 1, 0.32, 1],
} as const;
/** the gap between the two pills once the flap has landed, as a share of H */
const GAP = 0.18;

/** three faint layers, a contact line, a short cast and a wide ambient */
const LIFT =
  "0 1px 2px rgb(0 0 0 / 0.06), 0 6px 14px -4px rgb(0 0 0 / 0.08), 0 18px 36px -12px rgb(0 0 0 / 0.12)";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The dotted ring round the code, as dots rather than a dotted border. A CSS
 * border spaces its dots per side, so the curve and the straight run never
 * agree. This is one stroke round a stadium with a zero-length dash and a
 * round cap, and the pitch is the perimeter divided by a whole number of dots,
 * so the ring closes on a dot rather than on half a gap.
 */
function Dots({ w, h }: { w: number; h: number }) {
  const inset = h * 0.13;
  const rw = w - inset * 2;
  const rh = h - inset * 2;
  if (rw <= 0 || rh <= 0) return null;
  const perimeter = 2 * (rw - rh) + Math.PI * rh;
  const pitch = perimeter / Math.round(perimeter / (h * 0.11));
  return (
    <svg
      aria-hidden="true"
      width={w}
      height={h}
      className="pointer-events-none absolute inset-0"
    >
      <rect
        x={inset}
        y={inset}
        width={rw}
        height={rh}
        rx={rh / 2}
        fill="none"
        strokeWidth={h * 0.045}
        strokeLinecap="round"
        strokeDasharray={`0 ${pitch}`}
        className="stroke-stroke-strong"
      />
    </svg>
  );
}

export default function InviteFlap() {
  const reduce = useReducedMotion();
  const id = useId();
  const slot = useRef<HTMLDivElement>(null);
  const flap = useRef<HTMLButtonElement>(null);
  const code = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const rot = useMotionValue(0);
  const tip = useMotionValue(0);
  const rise = useMotionValue(0);
  const shift = useMotionValue(0);
  // what the flap paints: the flip plus whatever the pointer is doing to it
  const turn = useTransform(() => rot.get() + tip.get());

  /*
   * The light. Each face dims a little as it turns edge-on, since a face seen
   * along its own plane is catching light across it rather than on it. The
   * code's top edge sits in the flap's shadow while the flap stands over it.
   */
  const frontShade = useTransform(rot, (r) => clamp01(r / 90) * 0.1);
  const backShade = useTransform(rot, (r) => clamp01((180 - r) / 90) * 0.1);
  const cast = useTransform(
    rot,
    (r) => Math.sin((Math.min(180, Math.max(0, r)) * Math.PI) / 180) * 0.12,
  );
  // the code carries its own lift only once the flap is off it, or the two
  // shadows stack under the shut flap into one that is twice as dark
  const seat = useTransform(rot, (r) => clamp01(r / 60));

  // the slot is sized in `cqw` off the stage, so the dots and the pivot are
  // measured from it rather than restated
  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const read = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      setSize((was) => (was.w === w && was.h === h ? was : { w, h }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const gap = size.h * GAP;

  useEffect(() => {
    if (reduce) {
      rot.jump(open ? 180 : 0);
      return;
    }
    const run = animate(rot, open ? 180 : 0, FLIP);
    return () => run.stop();
  }, [open, reduce, rot]);

  // the peek lets go the moment the flap is asked to open, so the flip takes
  // over from a tipped page rather than waiting for it to settle
  useEffect(() => {
    const on = peek && !open && !reduce;
    const runs = [
      animate(tip, on ? PEEK.tip : 0, PEEK_EASE),
      animate(rise, on ? -size.h * PEEK.rise : 0, PEEK_EASE),
    ];
    return () => {
      for (const run of runs) run.stop();
    };
  }, [peek, open, reduce, size.h, tip, rise]);

  /*
   * The pair recentres as it opens. The flap lands a whole pill and a gap
   * above the code, so the code comes down half of that and the two end
   * centred on the stage the way the one did. A spring of its own and not a
   * reading of the flap's angle, or the hover peek would slide the slot a few
   * pixels under the pointer that caused it.
   */
  useEffect(() => {
    const to = open ? (size.h + gap) / 2 : 0;
    if (reduce || size.h === 0) {
      shift.jump(to);
      return;
    }
    const run = animate(shift, to, SHIFT);
    return () => run.stop();
  }, [open, size.h, gap, reduce, shift]);

  // Hover lifts the corner of the page, mouse and pen only. Heard on the slot,
  // which never moves while the flap is shut, rather than on the flap, which
  // does: a target that lifts away from the pointer is the loop
  // `document-pocket` documents.
  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || e.pointerType === "pen") setPeek(true);
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || e.pointerType === "pen") setPeek(false);
    };
    node.addEventListener("pointerenter", enter);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointerenter", enter);
      node.removeEventListener("pointerleave", leave);
    };
  }, []);

  // Escape puts the flap back, and a keyboard reader inside the code, which
  // is about to go inert, is handed back to the flap
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (code.current?.contains(document.activeElement)) flap.current?.focus();
      setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(() => {
    // a clipboard that refuses, in an insecure context or a denied
    // permission, still gets the confirmation: the code is on screen
    navigator.clipboard?.writeText(CODE).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  return (
    <div className="@container relative flex aspect-8/5 min-h-72 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset">
      <motion.div
        ref={slot}
        style={{
          y: shift,
          // every length in the piece is a share of the pill, and the pill is
          // a share of the stage, so a phone gets the same drawing smaller
          ["--w" as string]: "min(78cqw, 22rem)",
          ["--h" as string]: "calc(var(--w) * 0.235)",
          ["--rim" as string]: "calc(var(--h) * 0.085)",
        }}
        className="relative h-(--h) w-(--w) perspective-[700px]"
      >
        {/* The flap. It hinges on a line half a gap above the pill, so after
            half a turn it lands one gap clear of the code rather than sitting
            on its top edge. Its back is pre-turned by 180 degrees, so it reads
            upright once the flap has gone over.

            It comes first in the tree so Tab reaches it before the copy
            control, and `z-10` is what paints it over the code. */}
        <motion.button
          ref={flap}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Hide the invite code" : "Show the invite code"}
          onClick={() => setOpen((o) => !o)}
          style={{
            rotateX: turn,
            y: rise,
            transformOrigin: `50% ${-gap / 2}px`,
          }}
          className={cn(
            "group absolute inset-0 z-10 cursor-pointer rounded-full transform-3d",
            FOCUS,
          )}
        >
          <span
            aria-hidden="true"
            style={{ boxShadow: LIFT }}
            className="absolute inset-0 rounded-full bg-bg p-(--rim) backface-hidden"
          >
            <span className="flex size-full items-center justify-between rounded-full bg-surface pr-[calc(var(--h)*0.06)] pl-[calc(var(--h)*0.34)] transition-colors duration-150 group-hover:bg-fill group-active:bg-fill-hover group-active:duration-0">
              <span className="font-medium text-[length:calc(var(--h)*0.25)] text-text-primary leading-none">
                Your invite is ready
              </span>
              <span
                style={{ backgroundColor: GREEN, color: "#fff" }}
                className="grid aspect-square h-[calc(var(--h)*0.7)] place-items-center rounded-full"
              >
                <ArrowDownIcon className="size-[calc(var(--h)*0.3)] transition-transform duration-200 group-hover:translate-y-[calc(var(--h)*0.03)]" />
              </span>
            </span>
            <motion.span
              style={{ opacity: frontShade }}
              className="pointer-events-none absolute inset-0 rounded-full bg-black"
            />
          </span>
          <span
            aria-hidden="true"
            style={{ boxShadow: LIFT }}
            className="absolute inset-0 rounded-full bg-bg p-(--rim) backface-hidden [transform:rotateX(180deg)]"
          >
            <span className="flex size-full items-center justify-center rounded-full bg-surface transition-colors duration-150 group-hover:bg-fill group-active:bg-fill-hover group-active:duration-0">
              <span className="font-medium text-[length:calc(var(--h)*0.25)] text-text-secondary leading-none">
                Your invite code
              </span>
            </span>
            <motion.span
              style={{ opacity: backShade }}
              className="pointer-events-none absolute inset-0 rounded-full bg-black"
            />
          </span>
        </motion.button>

        {/* The code. Mounted the whole time and covered by the flap while it
            is shut, so it is inert until the flap is off it. */}
        <div
          ref={code}
          id={id}
          inert={!open}
          className="absolute inset-0 rounded-full bg-bg"
        >
          <motion.div
            aria-hidden="true"
            style={{ opacity: seat, boxShadow: LIFT }}
            className="pointer-events-none absolute inset-0 rounded-full"
          />
          <Dots w={size.w} h={size.h} />
          <motion.div
            aria-hidden="true"
            style={{ opacity: cast }}
            className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-b from-black to-transparent to-45%"
          />
          <div className="relative flex size-full items-center justify-between pr-[calc(var(--h)*0.2)] pl-[calc(var(--h)*0.42)]">
            <span className="font-semibold text-[length:calc(var(--h)*0.3)] text-text-primary leading-none [text-transform:none]">
              {CODE}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy the code"}
              style={{ backgroundColor: GREEN, color: "#fff" }}
              className={cn(
                "relative flex h-[calc(var(--h)*0.56)] cursor-pointer items-center rounded-full px-[calc(var(--h)*0.26)]",
                "font-semibold text-[length:calc(var(--h)*0.21)] leading-none",
                // shading a filled control is black at alpha over its own hue
                "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-black/0 after:transition-colors after:duration-150",
                "hover:after:bg-black/10 active:after:bg-black/20 active:after:duration-0",
                FOCUS,
              )}
            >
              <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
                {copied ? "Copied" : "Copy"}
              </TextMorph>
            </button>
            <span aria-live="polite" className="sr-only">
              {copied ? "Code copied" : ""}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
