"use client";

import { motion, useSpring } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { cn } from "@/lib/utils";
import { type Dealt, PACK, type Rarity, STOCK } from "./cards";
import { CH, CR, CW } from "./pack";
import { FLECK, GRAIN } from "./texture";

/*
 * One card: a back in the pack's foil, a face with its picture, and a flip
 * between them. Every length inside is px at the card's design size, and the
 * scene scales the whole stage, so the type never reflows.
 *
 * It is built the way a printed trading card is. The stock has a cut edge
 * that shows when the card turns. The face is full-art, a photograph to the
 * edge with a printed keyline inside it, and the type is only the name, a
 * caption, the number and the rarity. The back is printed to a border of
 * bare stock, in a rosette of fine lines the way a banknote's ground is. A
 * holo card carries a foil film over its whole face: a band of spectrum that
 * slides against the pointer, a fine diagonal line pattern and flecks, all
 * stronger as the card tips.
 *
 * Depth is `specimen-stack`'s: a lift shadow that deepens with `--l`, a
 * hairline of light inside the edge, a glare placed by `--gx`, `--gy` and
 * `--ga`, a tilt toward the pointer on a spring, and a fade by `--dim`. Every
 * one of those is written straight to the node, so a hover never renders.
 */

/**
 * The lift a card casts, deeper as `--l` rises. Offset down and to the right,
 * since the scene's one key light is up and to the left.
 */
const LIFT =
  "calc(4px + var(--l, 0) * 10px) calc(9px + var(--l, 0) * 30px) calc(22px + var(--l, 0) * 46px) rgb(0 0 0 / calc(0.2 + var(--l, 0) * 0.12)), 1px 2px 4px rgb(0 0 0 / 0.16), 0 0 0 0.5px rgb(0 0 0 / 0.1)";

const FACE = "absolute inset-0 overflow-hidden backface-hidden";

/**
 * Half the card's thickness, in px. Each face sits this far out from the
 * middle and three layers of cut edge fill the gap, so a card seen at an
 * angle, mid-flip or tipped under the pointer, shows a rim of stock rather
 * than vanishing into a plane.
 */
const HALF = 1.2;
const CORE = [-0.6, 0, 0.6];

/** the bare stock round the print, and the print's own inset */
const BORDER = 7;
const WINDOW_R = CR - 4;

/** a hairline of light inside the edge, and a little weight at the foot */
function Edge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.7), inset 0 0 0 1px rgb(255 255 255 / 0.25), inset 0 -30px 50px -40px rgb(0 0 0 / 0.16)",
      }}
    />
  );
}

/**
 * How far back in the fan the card is, as a fade toward the stage. A dark
 * face takes half of it, since the light stage over indigo read as a grey
 * wash rather than as distance.
 */
function Dim({ amount = 1 }: { amount?: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-fill"
      style={{ opacity: `calc(var(--dim, 0) * ${amount})` }}
    />
  );
}

/** a light that follows the tilt: a soft glow and a raking band */
function Glare() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
      style={{
        opacity: "var(--ga, 0)",
        background:
          "radial-gradient(circle at calc(var(--gx, 50) * 1%) calc(var(--gy, 30) * 1%), rgb(255 255 255 / 0.8) 0%, rgb(255 255 255 / 0) 55%), linear-gradient(calc(110deg + var(--gx, 50) * 0.6deg), rgb(255 255 255 / 0) 35%, rgb(255 255 255 / 0.22) 50%, rgb(255 255 255 / 0) 65%)",
      }}
    />
  );
}

/** card stock's tooth, and the laminate's sheen across it */
function Stock() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-30 mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, backgroundSize: "240px 240px" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
        style={{
          backgroundImage:
            "linear-gradient(155deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0) 38%, rgb(0 0 0 / 0) 70%, rgb(0 0 0 / 0.1))",
        }}
      />
    </>
  );
}

/** a rosette of fine ellipses, printed into the back's ground */
const ROSETTE = Array.from({ length: 36 }, (_, i) => i * 5);

function Back() {
  return (
    <span
      className={FACE}
      style={{
        borderRadius: CR,
        boxShadow: LIFT,
        backgroundColor: STOCK.face,
        transform: `translateZ(${HALF}px)`,
      }}
    >
      <span
        className="absolute overflow-hidden"
        style={{
          inset: BORDER,
          borderRadius: WINDOW_R,
          backgroundImage: `radial-gradient(120% 80% at 50% 40%, rgb(255 255 255 / 0.12), transparent 60%), linear-gradient(160deg, ${PACK.from}, ${PACK.to})`,
          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.2)",
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="-81 -119 162 238"
          className="absolute inset-0 size-full"
          fill="none"
        >
          {ROSETTE.map((a) => (
            <ellipse
              key={a}
              rx="58"
              ry="22"
              transform={`rotate(${a})`}
              stroke="#fff"
              strokeOpacity="0.09"
              strokeWidth="0.6"
            />
          ))}
          {ROSETTE.map((a) => (
            <ellipse
              key={`i${a}`}
              rx="30"
              ry="11"
              transform={`rotate(${a + 2.5})`}
              stroke="#fff"
              strokeOpacity="0.12"
              strokeWidth="0.5"
            />
          ))}
          <rect
            x="-74"
            y="-112"
            width="148"
            height="224"
            rx="5"
            stroke="#fff"
            strokeOpacity="0.22"
            strokeWidth="0.75"
          />
          <rect
            x="-71"
            y="-109"
            width="142"
            height="218"
            rx="3.5"
            stroke="#fff"
            strokeOpacity="0.1"
            strokeWidth="0.5"
          />
          {/* the mark, stamped in foil at the rosette's heart */}
          <g transform="rotate(45)">
            <rect
              x="-15"
              y="-15"
              width="30"
              height="30"
              rx="6"
              fill="#fff"
              fillOpacity="0.08"
              stroke="#fff"
              strokeOpacity="0.5"
              strokeWidth="0.9"
            />
            <rect
              x="-8"
              y="-8"
              width="16"
              height="16"
              rx="3.5"
              fill="#fff"
              fillOpacity="0.55"
            />
          </g>
        </svg>
        <span
          className="absolute inset-x-0 bottom-[12px] text-center font-mono text-[8px] tracking-[0.18em]"
          style={{ color: "#fff", opacity: 0.55 }}
        >
          field studies
        </span>
      </span>
      <Stock />
      <Dim />
      <Glare />
      <Edge />
    </span>
  );
}

/** the cut edge between the faces, which only shows when the card is turned */
function Core() {
  return (
    <>
      {CORE.map((z) => (
        <span
          key={z}
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            borderRadius: CR,
            backgroundColor: STOCK.edge,
            transform: `translateZ(${z}px)`,
          }}
        />
      ))}
    </>
  );
}

const RARITY = ["", "common", "uncommon", "rare"] as const;

/**
 * Whether a backdrop is light enough for dark type. The photographs are all
 * on pale paper but one, dusk's indigo, so the type follows the backdrop
 * rather than being one colour on every card.
 */
function isLight(hex: string): boolean {
  const v = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/** the rarity as one to three diamonds, filled in the type's own colour */
function Pips({ rarity, tone }: { rarity: Rarity; tone: string }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className="inline-block size-[4.5px] shrink-0 rotate-45 rounded-[1px]"
          style={{
            backgroundColor: n <= rarity ? tone : "transparent",
            boxShadow: n <= rarity ? "none" : `inset 0 0 0 0.75px ${tone}`,
            opacity: n <= rarity ? 0.85 : 0.4,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The holo film over the whole face. On a light card it is a colour dodge,
 * which lifts the spectrum out of pale paper. On a dark one the same dodge
 * blew the indigo out to a pastel wash and lost the photograph, so a dark
 * card takes the film as a gentler screen.
 */
function Holo({ dark }: { dark: boolean }) {
  const blend = dark ? "mix-blend-screen" : "mix-blend-color-dodge";
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0", blend)}
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 22%, #ff9ec0 34%, #ffe08a 42%, #9ef0c6 50%, #8fd0ff 58%, #c9a6ff 66%, transparent 78%)",
          backgroundSize: "260% 100%",
          backgroundPosition: "var(--holo, 50%) 0",
          opacity: dark
            ? "calc(0.1 + var(--ga, 0) * 0.22)"
            : "calc(0.3 + var(--ga, 0) * 0.4)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.35) 0 1px, transparent 1px 4px)",
          opacity: dark
            ? "calc(0.08 + var(--ga, 0) * 0.15)"
            : "calc(0.2 + var(--ga, 0) * 0.35)",
        }}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0", blend)}
        style={{
          backgroundImage: FLECK,
          backgroundSize: "120px 120px",
          opacity: dark
            ? "calc(0.03 + var(--ga, 0) * 0.1)"
            : "calc(0.05 + var(--ga, 0) * 0.18)",
        }}
      />
    </>
  );
}

/**
 * The face is full-art: the photograph runs to the card's edge and is the
 * card. The type is cut to what a collector reads first, the name and its
 * caption at the foot and the number and rarity small at the head, and the
 * photograph's own backdrop rises behind the name so it reads without a
 * band. A printed keyline inside the edge frames it, the way a full-art
 * card's border is printed rather than cut.
 */
function Face({ card }: { card: Dealt }) {
  const { study, no, holo } = card;
  const light = isLight(study.ground);
  const ink = light ? "rgb(24 22 30)" : "rgb(255 255 255)";
  return (
    <span
      className={FACE}
      style={{
        borderRadius: CR,
        boxShadow: LIFT,
        backgroundColor: study.ground,
        transform: `rotateY(180deg) translateZ(${HALF}px)`,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: a 640px still already on disk, painted into a card a fraction of that, is not worth an image pipeline, as in `specimen-stack` */}
      <img
        src={`/assets/card-pack/${study.name}.webp`}
        alt=""
        draggable={false}
        // the photo is square and the card tall, so it sits at the card's
        // full width in the upper part and fades at its foot into the ground,
        // which is its own backdrop colour. Filling the height enlarged it
        // 1.4 times and cut the objects at the sides
        className="pointer-events-none absolute inset-x-0 top-0 block aspect-square w-full select-none"
        style={{
          transform: "scale(1.08)",
          transformOrigin: "50% 40%",
          maskImage: "linear-gradient(180deg, #000 72%, transparent 96%)",
        }}
      />
      {/* the halftone grain of the print, faint over the photograph */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
      />
      {holo ? <Holo dark={!light} /> : null}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px]"
        style={{
          borderRadius: CR - 3,
          boxShadow: light
            ? "inset 0 0 0 0.75px rgb(255 255 255 / 0.55)"
            : "inset 0 0 0 0.75px rgb(255 255 255 / 0.22)",
        }}
      />

      <span
        className="absolute inset-x-[13px] top-[12px] flex items-center justify-between font-mono text-[8.5px] leading-none tracking-[0.08em] tabular-nums"
        style={{ color: ink, opacity: 0.55 }}
      >
        <span>no. {String(no).padStart(2, "0")}</span>
        <Pips rarity={study.rarity} tone={ink} />
      </span>
      <span className="absolute inset-x-[13px] bottom-[13px] flex flex-col gap-[5px] text-left">
        <span
          className="font-semibold text-[19px] leading-none tracking-[-0.03em]"
          style={{ color: ink }}
        >
          {study.name}
        </span>
        <span
          className="truncate text-[9.5px] leading-none"
          style={{ color: ink, opacity: 0.6 }}
        >
          {study.caption}
        </span>
      </span>
      <Stock />
      <Dim amount={light ? 1 : 0.5} />
      <Glare />
      <Edge />
    </span>
  );
}

/** how far a card tips toward the pointer, in degrees */
const TIP = 9;

const TILT = { stiffness: 260, damping: 22 };

export function Card({
  card,
  index,
  flipped,
  interactive,
  reduce,
  onFlip,
}: {
  card: Dealt;
  index: number;
  flipped: boolean;
  interactive: boolean;
  reduce: boolean;
  onFlip: (index: number) => void;
}) {
  const node = useRef<HTMLButtonElement>(null);
  const rx = useSpring(0, TILT);
  const ry = useSpring(0, TILT);

  const point = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = node.current;
    if (!el || !interactive) return;
    const b = el.getBoundingClientRect();
    const u = (e.clientX - b.left) / b.width;
    const v = (e.clientY - b.top) / b.height;
    el.style.setProperty("--gx", `${u * 100}`);
    el.style.setProperty("--gy", `${v * 100}`);
    el.style.setProperty("--ga", "1");
    el.style.setProperty("--l", "1");
    // the band runs the other way to the pointer, the way a reflection does
    if (card.holo) el.style.setProperty("--holo", `${(1 - u) * 100}%`);
    if (reduce) return;
    // a flipped card is seen from behind, so its tilt runs the other way
    const side = flipped ? -1 : 1;
    rx.set((0.5 - v) * TIP * 2);
    ry.set((u - 0.5) * TIP * 2 * side);
  };

  const leave = () => {
    const el = node.current;
    // the hand's light goes, and the card falls back to the light it catches
    // at its place in the fan, which its wrapper sets
    if (el) {
      for (const v of ["--gx", "--gy", "--ga", "--l"]) {
        el.style.removeProperty(v);
      }
    }
    rx.set(0);
    ry.set(0);
  };

  const label = flipped
    ? `${card.study.name}, ${RARITY[card.study.rarity]}${card.holo ? ", holo" : ""}`
    : `Flip card ${index + 1}`;

  return (
    <button
      ref={node}
      type="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={label}
      aria-pressed={flipped}
      onClick={() => onFlip(index)}
      onPointerMove={point}
      onPointerLeave={leave}
      className={cn(
        "relative block perspective-distant",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
        interactive ? "cursor-pointer" : "pointer-events-none",
      )}
      style={{ width: CW, height: CH, borderRadius: CR }}
    >
      <motion.span
        className="relative block size-full transform-3d"
        style={{ rotateX: rx, rotateY: ry }}
      >
        <motion.span
          className="relative block size-full transform-3d"
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", duration: 0.6, bounce: 0.2 }
          }
        >
          <Core />
          <Back />
          <Face card={card} />
        </motion.span>
      </motion.span>
    </button>
  );
}
