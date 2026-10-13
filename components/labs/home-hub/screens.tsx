"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { DotsThreeIcon, PauseIcon, SunIcon, XIcon } from "@/components/icons";

/*
 * The five screens. Each is a picture of a device's display, drawn rather
 * than fetched, since `/privacy` promises no image from another origin.
 *
 * Everything inside a screen is sized in `cqw` against the display, so it is
 * off the type scale on purpose: it is printing on a drawn object, the
 * standing `foil-card` gives its card. The screens keep their casing, since a
 * device's own interface is not this site's copy, which is why the face sets
 * `text-transform` inline rather than through a class the unlayered button
 * rule could beat.
 *
 * The few glyphs the icon set has no drawing for, a lock, a bulb, a camera, a
 * microphone and the two skip arrows, are drawn here as artwork on the
 * picture, the standing `tether-button`'s hands have.
 */

/* One clock for every screen, ticking on the wall clock's own second. Ten
   hubs carry up to two clocks each, and one interval serves all of them. */

let now = new Date();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  now = new Date();
  for (const listen of listeners) listen();
  timer = setTimeout(tick, 1000 - (Date.now() % 1000));
}

function subscribe(listen: () => void) {
  listeners.add(listen);
  if (!timer) {
    now = new Date();
    timer = setTimeout(tick, 1000 - (Date.now() % 1000));
  }
  return () => {
    listeners.delete(listen);
    if (listeners.size === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

function useNow(): Date {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}

const FACE: CSSProperties = { textTransform: "none" };

function Face({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="@container absolute inset-0 overflow-hidden font-sans text-white leading-none"
      style={{ ...FACE, ...style }}
    >
      {children}
    </div>
  );
}

/** an analog face, its hands on the live time */
function Dial({
  size,
  face,
  ink,
  accent,
}: {
  size: string;
  face: string;
  ink: string;
  accent: string;
}) {
  const t = useNow();
  const s = t.getSeconds();
  const m = t.getMinutes() + s / 60;
  const h = (t.getHours() % 12) + m / 60;
  const hand = (deg: number, length: number, width: number, colour: string) => (
    <line
      x1="50"
      y1="50"
      x2={50 + Math.sin((deg * Math.PI) / 180) * length}
      y2={50 - Math.cos((deg * Math.PI) / 180) * length}
      stroke={colour}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <circle cx="50" cy="50" r="48" fill={face} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const r0 = i % 3 === 0 ? 34 : 38;
        return (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed ticks
            key={i}
            x1={50 + Math.sin(a) * r0}
            y1={50 - Math.cos(a) * r0}
            x2={50 + Math.sin(a) * 43}
            y2={50 - Math.cos(a) * 43}
            stroke={ink}
            strokeWidth={i % 3 === 0 ? 3 : 1.6}
            strokeLinecap="round"
          />
        );
      })}
      {hand(h * 30, 22, 5, ink)}
      {hand(m * 6, 33, 3.5, ink)}
      {hand(s * 6, 38, 1.4, accent)}
      <circle cx="50" cy="50" r="3" fill={accent} />
    </svg>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** widgets on black: the date, a dial, the weather and what is playing */
function Widgets() {
  const t = useNow();
  return (
    <Face style={{ background: "#000" }}>
      <div className="absolute top-[9cqw] left-[9cqw] flex flex-col gap-[2cqw]">
        <span className="font-semibold text-[7.5cqw]">
          <span style={{ color: "#ff9f0a" }}>{DAYS[t.getDay()]}</span>{" "}
          {MONTHS[t.getMonth()]}
        </span>
        <span className="font-light text-[30cqw] tracking-[-0.04em]">
          {t.getDate()}
        </span>
      </div>
      <div className="absolute top-[7cqw] right-[7cqw]">
        <Dial size="40cqw" face="#1c1c1e" ink="#fff" accent="#ff9f0a" />
      </div>
      <div className="absolute bottom-[8cqw] left-[9cqw] flex flex-col gap-[2cqw]">
        <span
          className="block size-[19cqw] rounded-[3cqw]"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, #ff5a3c 0 8%, transparent 9%), linear-gradient(160deg, #9fd0ff, #e9f3ff 60%, #b7c9e8)",
          }}
        />
        <span className="font-semibold text-[4.5cqw]">Night Swim</span>
        <span className="text-[4cqw] text-white/55">Lumen</span>
      </div>
      <div className="absolute right-[9cqw] bottom-[8cqw] flex flex-col items-end gap-[2cqw]">
        <span className="flex items-center gap-[1.5cqw] font-semibold text-[4.5cqw]">
          <SunIcon className="size-[5cqw]" style={{ color: "#ffd60a" }} />
          Lisbon
        </span>
        <span className="font-light text-[19cqw] tracking-[-0.04em]">21°</span>
        <span className="text-[4cqw] text-white/55">Partly cloudy</span>
      </div>
    </Face>
  );
}

function Camera() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-1/2">
      <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" fill="#30d158" />
      <path d="M16 11 21 7.5v9L16 13z" fill="#30d158" />
    </svg>
  );
}

function Mic() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-1/2">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="#ff9f0a" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4"
        fill="none"
        stroke="#ff9f0a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** an incoming video call, ringing */
function Call() {
  return (
    <Face
      style={{
        background:
          "radial-gradient(60% 50% at 25% 30%, #e9b48f, transparent), radial-gradient(50% 60% at 80% 70%, #8a8f5a, transparent), radial-gradient(70% 60% at 60% 20%, #d98579, transparent), #6d5a4a",
      }}
    >
      <span className="absolute top-[8cqw] left-[9cqw] font-medium text-[9cqw]">
        Mari
      </span>
      <span className="absolute top-[19cqw] left-[9cqw] text-[4.5cqw] text-white/70">
        Video call
      </span>
      <span
        className="absolute top-[6cqw] right-[6cqw] h-[30cqw] w-[24cqw] rounded-[4cqw] ring-1 ring-white/40"
        style={{
          background:
            "radial-gradient(40% 35% at 50% 42%, #7a4c36 0 60%, transparent 62%), radial-gradient(70% 45% at 50% 100%, #3f7a52 0 70%, transparent 72%), linear-gradient(#d9d4c8, #b9b3a5)",
        }}
      />
      <div className="absolute top-[42cqw] left-1/2 -translate-x-1/2">
        <span className="absolute inset-0 rounded-full bg-white/30 motion-safe:animate-ping" />
        <span
          className="relative flex size-[26cqw] items-center justify-center rounded-full font-medium text-[11cqw]"
          style={{ background: "linear-gradient(#c58a6a, #8d5a45)" }}
        >
          M
        </span>
      </div>
      <div className="absolute inset-x-[8cqw] bottom-[7cqw] flex items-center justify-between">
        <span className="flex size-[15cqw] items-center justify-center rounded-full bg-white">
          <Camera />
        </span>
        <span className="flex size-[15cqw] items-center justify-center rounded-full bg-white">
          <Mic />
        </span>
        <span className="flex size-[15cqw] items-center justify-center rounded-full bg-white/25">
          <DotsThreeIcon className="size-1/2" />
        </span>
        <span
          className="flex size-[15cqw] items-center justify-center rounded-full"
          style={{ background: "#ff3b30" }}
        >
          <XIcon className="size-1/2" />
        </span>
      </div>
    </Face>
  );
}

/** the time, frosted, over a wall in dappled light */
function Frame() {
  const t = useNow();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return (
    <Face
      style={{
        background:
          "radial-gradient(30% 25% at 78% 22%, rgba(20,45,38,0.55), transparent), radial-gradient(25% 30% at 88% 55%, rgba(20,45,38,0.45), transparent), radial-gradient(35% 30% at 12% 70%, rgba(255,255,230,0.25), transparent), radial-gradient(60% 50% at 40% 30%, #8fb5a3, transparent), linear-gradient(170deg, #79a392, #4f7a6c)",
      }}
    >
      <span
        className="absolute inset-x-0 top-[10cqw] text-center font-semibold text-[38cqw] tracking-[-0.06em] tabular-nums"
        style={{
          color: "rgba(255,255,255,0.32)",
          WebkitTextStroke: "0.3cqw rgba(255,255,255,0.75)",
          textShadow: "0 0.6cqw 2cqw rgba(20,50,40,0.35)",
        }}
      >
        {hh}:{mm}
      </span>
      <span
        className="absolute bottom-[-18cqw] left-1/2 h-[62cqw] w-[56cqw] -translate-x-1/2 rounded-t-full"
        style={{
          background:
            "radial-gradient(45% 30% at 50% 30%, #e7739a, transparent), linear-gradient(#d95f86, #b8466a)",
        }}
      />
      <span
        className="absolute bottom-[34cqw] left-1/2 size-[16cqw] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #f6c9d3, #e08aa2 70%)",
          boxShadow: "inset 0 0 0 0.4cqw rgba(255,255,255,0.35)",
        }}
      />
    </Face>
  );
}

function Lock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[7cqw]">
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <rect x="5" y="10" width="14" height="11" rx="2.5" fill="#fff" />
    </svg>
  );
}

function Bulb() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[7cqw]">
      <path
        d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V17h6v-1.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z"
        fill="#fff"
      />
      <rect x="9" y="18.5" width="6" height="2.5" rx="1" fill="#fff" />
    </svg>
  );
}

function Tile({
  icon,
  title,
  sub,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center justify-end gap-[1.5cqw] rounded-[5cqw] bg-white/15 pb-[3cqw] ring-1 ring-white/20">
      {icon}
      <span className="font-semibold text-[3.6cqw]">{title}</span>
      <span className="text-[3.2cqw] text-white/65">{sub}</span>
    </div>
  );
}

/** home controls on amber: the thermostat, a dial and three scenes */
function Home() {
  return (
    <Face
      style={{
        background:
          "radial-gradient(50% 40% at 30% 20%, #f8c870, transparent), radial-gradient(60% 50% at 80% 80%, #a55a12, transparent), linear-gradient(150deg, #e7a23f, #b8681c)",
      }}
    >
      <div className="absolute inset-[5cqw] grid grid-cols-3 grid-rows-[1.1fr_1fr] gap-[3cqw]">
        <div className="col-span-2 flex flex-col justify-between rounded-[5cqw] bg-white/10 p-[4cqw] ring-1 ring-white/20">
          <span className="font-semibold text-[22cqw] tracking-[-0.04em]">
            68
          </span>
          <span className="flex flex-col gap-[1cqw]">
            <span className="font-semibold text-[3.8cqw]">Thermostat</span>
            <span className="text-[3.4cqw] text-white/65">Living room</span>
          </span>
        </div>
        <div className="flex items-center justify-center rounded-[5cqw] bg-white/10 ring-1 ring-white/20">
          <Dial
            size="24cqw"
            face="rgba(255,236,190,0.9)"
            ink="#7a4510"
            accent="#d9461b"
          />
        </div>
        <Tile
          icon={<SunIcon className="size-[7cqw]" />}
          title="Good Morning"
          sub="Scene"
        />
        <Tile icon={<Lock />} title="Door Lock" sub="Front door" />
        <Tile icon={<Bulb />} title="Lights" sub="Entryway" />
      </div>
    </Face>
  );
}

function Skip({ back }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[8cqw]"
      style={back ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M3 6.5v11L11.5 12zM12 6.5v11l8.5-5.5z" fill="#fff" />
    </svg>
  );
}

/** what is playing, on the album's own colours */
function Music() {
  return (
    <Face
      style={{
        background:
          "radial-gradient(60% 50% at 30% 30%, #3d6fa8, transparent), radial-gradient(50% 50% at 80% 90%, #0f1e3a, transparent), linear-gradient(160deg, #24456e, #0b1426)",
      }}
    >
      <span
        className="absolute top-[8cqw] left-[9cqw] size-[46cqw] rounded-[4cqw] shadow-[0_2cqw_5cqw_rgba(0,0,0,0.4)]"
        style={{
          background:
            "radial-gradient(9% 9% at 62% 40%, #ff5a3c 0 90%, transparent 100%), radial-gradient(40% 18% at 35% 75%, rgba(255,255,255,0.9), transparent), linear-gradient(170deg, #6fb3ff, #d8ecff 70%, #a9c4e6)",
        }}
      />
      <div className="absolute top-[10cqw] right-[8cqw] left-[60cqw] flex flex-col gap-[2cqw]">
        <span className="font-semibold text-[6.5cqw]">Night Swim</span>
        <span className="text-[5cqw] text-white/60">Lumen</span>
      </div>
      <div className="absolute inset-x-[9cqw] bottom-[24cqw] h-[1.4cqw] overflow-hidden rounded-full bg-white/25">
        <span className="block h-full w-full origin-left rounded-full bg-white/85 motion-safe:animate-[hub-progress_40s_linear_infinite] motion-reduce:scale-x-[0.4]" />
      </div>
      <div className="absolute inset-x-[22cqw] bottom-[8cqw] flex items-center justify-between">
        <Skip back />
        <PauseIcon className="size-[10cqw]" />
        <Skip />
      </div>
    </Face>
  );
}

export const SCREENS = [
  { name: "Widgets", Screen: Widgets },
  { name: "Call", Screen: Call },
  { name: "Clock", Screen: Frame },
  { name: "Home", Screen: Home },
  { name: "Music", Screen: Music },
] as const;
