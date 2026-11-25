"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Cycle, Frame, RAISED } from "@/components/blogs/frame";
import {
  CodeIcon,
  CopyIcon,
  DiamondIcon,
  FileTextIcon,
  FlagIcon,
  FlameIcon,
  LinkIcon,
  MinusIcon,
  NoteIcon,
  PlusIcon,
  SquaresFourIcon,
  TerminalIcon,
  TerminalWindowIcon,
  TrashIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The demos for the menus and chrome in the post: the sidebar toggle, the menu
 * bar and its tooltips, the window buttons and the dropdown that moves.
 */

const PANEL = { type: "spring", visualDuration: 0.32, bounce: 0 } as const;

/** a grey bar standing in for a line of text */
function Line({ className }: { className?: string }) {
  return (
    <span className={cn("block h-2 rounded-full bg-fill-active", className)} />
  );
}

/* ---------------------------------------------------------------- sidebar */

/**
 * The sidebar and the bar in its toggle run on one spring, so the icon and
 * the panel read as one change. The bar is the icon's drawing of the
 * sidebar's edge.
 */
export function SidebarDemo() {
  const [open, setOpen] = useState(true);
  const [pressed, setPressed] = useState(false);

  return (
    <Frame hint="Press the toggle.">
      <div
        className={cn(
          "relative mx-auto flex h-56 w-full max-w-120 overflow-hidden rounded-lg",
          RAISED,
        )}
      >
        <motion.div
          initial={false}
          animate={{ width: open ? 132 : 0 }}
          transition={PANEL}
          className="shrink-0 overflow-hidden border-stroke border-r bg-surface"
        >
          <div className="flex w-33 flex-col gap-3 p-5 pt-14">
            <Line className="w-3/4 bg-text-muted/40" />
            <Line className="w-2/3" />
            <Line className="w-4/5" />
            <Line className="w-1/2" />
            <Line className="w-3/5" />
          </div>
        </motion.div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 pt-14">
          <Line className="h-3 w-2/5 bg-text-muted/40" />
          <Line className="w-full" />
          <Line className="w-11/12" />
          <Line className="w-4/5" />
          <Line className="w-full" />
          <Line className="w-2/3" />
        </div>
        <button
          type="button"
          aria-label={open ? "Hide the sidebar" : "Show the sidebar"}
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            setPressed(true);
          }}
          className="absolute top-3 left-3 grid size-8 cursor-pointer place-items-center rounded-md text-text-secondary transition-colors duration-200 hover:bg-fill hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 active:bg-fill-hover active:duration-0"
        >
          <svg viewBox="0 0 20 16" aria-hidden="true" className="w-5">
            <rect
              x="1"
              y="1"
              width="18"
              height="14"
              rx="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <motion.rect
              y="3.5"
              width="1.8"
              height="9"
              rx="0.9"
              fill="currentColor"
              initial={false}
              animate={{ attrX: open ? 6.6 : 3.4 }}
              transition={PANEL}
            />
          </svg>
          {pressed ? null : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-text-primary)_20%,transparent)] motion-safe:animate-[start-here_2.2s_ease-out_infinite]"
            />
          )}
        </button>
      </div>
    </Frame>
  );
}

/* --------------------------------------------------------------- menu bar */

const MENUS = [
  { name: "File", items: ["New note", "Open", "Save"] },
  { name: "Edit", items: ["Undo", "Redo", "Copy", "Paste"] },
  { name: "View", items: ["Zoom in", "Zoom out"] },
  { name: "Window", items: ["Minimise", "Bring all to front"] },
] as const;

const TOOLS = [
  { label: "Copy", Icon: CopyIcon },
  { label: "Link", Icon: LinkIcon },
  { label: "Flag", Icon: FlagIcon },
  { label: "Delete", Icon: TrashIcon },
] as const;

/** how long the first tooltip waits, and how long the group stays warm after */
const DELAY = 500;
const GRACE = 300;

/**
 * A menu bar where the first menu needs a click and the rest open on hover,
 * and a toolbar whose first tooltip waits and whose neighbours do not.
 */
export function MenuDemo() {
  const [menu, setMenu] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menu === null) return;
    const away = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [menu]);

  return (
    <Frame
      hint="Open a menu, then slide across. Then hover the toolbar."
      className="items-center gap-44"
    >
      <div
        ref={bar}
        role="menubar"
        className={cn("relative flex gap-1 rounded-[0.5rem] p-1", RAISED)}
      >
        {MENUS.map((m, i) => (
          <div key={m.name} className="relative flex">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={menu === i}
              /* a native menu opens on the press, not the click */
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                setMenu((cur) => (cur === i ? null : i));
              }}
              onPointerEnter={() => setMenu((cur) => (cur === null ? cur : i))}
              onClick={(e) => {
                if (e.detail === 0) setMenu((cur) => (cur === i ? null : i));
              }}
              className="h-8 cursor-pointer rounded-md px-3 pb-[0.16em] text-body text-text-primary transition-colors duration-150 hover:bg-fill aria-expanded:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              {m.name}
            </button>
            {menu === i ? (
              <div
                role="menu"
                className={cn(
                  "absolute top-full left-0 z-10 mt-2 flex w-max min-w-40 flex-col rounded-[0.5rem] p-1",
                  RAISED,
                )}
              >
                {m.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="menuitem"
                    onClick={() => setMenu(null)}
                    className="h-8 cursor-pointer whitespace-nowrap rounded-md px-3 pb-[0.16em] text-left text-body text-text-primary hover:bg-text-primary hover:text-bg focus-visible:bg-text-primary focus-visible:text-bg focus-visible:outline-none"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <Toolbar />
    </Frame>
  );
}

/** One tooltip for the whole group, which moves to the button under the pointer. */
function Toolbar() {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<number | null>(null);
  const warm = useRef(false);
  const wait = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cool = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const row = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const shown = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(wait.current);
      clearTimeout(cool.current);
    },
    [],
  );

  /* place the label over its button: glide while it is already showing, jump when it arrives */
  useEffect(() => {
    if (tip === null) {
      shown.current = false;
      return;
    }
    const b = buttons.current[tip];
    const r = row.current;
    if (!b || !r) return;
    const target = b.offsetLeft + b.offsetWidth / 2;
    if (shown.current && !reduce) {
      animate(x, target, { type: "spring", visualDuration: 0.2, bounce: 0 });
    } else {
      x.jump(target);
    }
    shown.current = true;
  }, [tip, x, reduce]);

  const enter = (i: number) => {
    clearTimeout(cool.current);
    clearTimeout(wait.current);
    if (warm.current) {
      setTip(i);
      return;
    }
    wait.current = setTimeout(() => {
      warm.current = true;
      setTip(i);
    }, DELAY);
  };

  const leave = () => {
    clearTimeout(wait.current);
    clearTimeout(cool.current);
    cool.current = setTimeout(() => {
      warm.current = false;
      setTip(null);
    }, GRACE);
  };

  return (
    <div
      ref={row}
      className={cn("relative flex gap-1 rounded-[0.5rem] p-1", RAISED)}
    >
      {TOOLS.map(({ label, Icon }, i) => (
        <button
          key={label}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          aria-label={label}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") enter(i);
          }}
          onPointerLeave={leave}
          onFocus={() => enter(i)}
          onBlur={leave}
          className="grid size-8 cursor-pointer place-items-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
      <motion.div
        aria-hidden="true"
        style={{ x }}
        className="pointer-events-none absolute bottom-full left-0 mb-2"
      >
        <AnimatePresence>
          {tip === null ? null : (
            <motion.span
              key="tip"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="-translate-x-1/2 block whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-meta font-medium"
              style={{ color: "#fff" }}
            >
              {TOOLS[tip].label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------- window buttons */

/** macOS's own close, minimise and zoom colours, scoped here as the platform's */
const LIGHTS = [
  { label: "Close", fill: "#ff5f57", Icon: XIcon },
  { label: "Minimise", fill: "#febc2e", Icon: MinusIcon },
  { label: "Zoom", fill: "#28c840", Icon: PlusIcon },
] as const;

/**
 * Three dots that answer as one group. The hover area is the group, so the
 * glyphs come up on all three as the pointer arrives at any of them. A tap
 * shows them on a touch screen, which has no hover.
 */
export function WindowDemo() {
  const [shown, setShown] = useState(false);

  return (
    <Frame hint="Hover a button.">
      <div
        className={cn(
          "mx-auto w-full max-w-100 overflow-hidden rounded-lg",
          RAISED,
        )}
      >
        <div className="flex h-11 items-center border-stroke border-b px-5">
          {/* the padding is part of the group's hover area, so moving between
              dots never drops the hover */}
          <div
            data-shown={shown || undefined}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") setShown((s) => !s);
            }}
            className="group/lights -m-1.5 flex gap-2 p-1.5"
          >
            {LIGHTS.map(({ label, fill, Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className="grid size-3.5 cursor-pointer place-items-center rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.18)] active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-1"
                style={{ background: fill }}
              >
                <Icon
                  aria-hidden="true"
                  className="size-2 text-black/55 opacity-0 transition-opacity duration-150 group-hover/lights:opacity-100 group-focus-within/lights:opacity-100 group-data-shown/lights:opacity-100"
                />
              </button>
            ))}
          </div>
          <span className="mx-auto pr-14 text-meta text-text-muted">notes</span>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <Line className="w-2/5 bg-text-muted/40" />
          <Line className="w-full" />
          <Line className="w-5/6" />
          <Line className="w-3/4" />
        </div>
      </div>
    </Frame>
  );
}

/* --------------------------------------------------------------- dropdown */

type Mode = "one panel" | "separate panels";
const MODES = ["one panel", "separate panels"] as const;

/**
 * One spring for everything that travels when the pointer moves to another
 * item: the panel's box, the content sliding inside it and the highlight under
 * the item. Sharing it is what keeps the three in step.
 */
const SHARED = { type: "spring", visualDuration: 0.2, bounce: 0 } as const;

/** each panel's width in px. Its height is measured off its own content. */
const NAV = [
  { name: "Products", w: 300 },
  { name: "Solutions", w: 220 },
  { name: "Developers", w: 260 },
] as const;

/** one entry in a panel: an icon on a raised tile, a name and a line of copy */
function Entry({
  Icon,
  name,
  line,
}: {
  Icon: (props: { className?: string }) => ReactNode;
  name: string;
  line: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md text-text-secondary",
          RAISED,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-text-primary">{name}</span>
        <span className="truncate text-meta text-text-muted">{line}</span>
      </span>
    </div>
  );
}

function Content({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 p-5">
        <Entry Icon={DiamondIcon} name="Payments" line="Take money" />
        <Entry Icon={FileTextIcon} name="Billing" line="Charge monthly" />
        <Entry Icon={NoteIcon} name="Invoicing" line="Send a bill" />
        <Entry Icon={TerminalWindowIcon} name="Terminal" line="In person" />
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Entry Icon={FlameIcon} name="Startups" line="Launch fast" />
        <Entry Icon={SquaresFourIcon} name="Platforms" line="Pay out sellers" />
        <Entry Icon={UserIcon} name="Enterprise" line="At scale" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 p-5">
      <Entry Icon={CodeIcon} name="Documentation" line="Guides and examples" />
      <Entry Icon={TerminalIcon} name="API reference" line="Every endpoint" />
    </div>
  );
}

/**
 * One panel that slides and resizes between the items, against a panel per
 * item that fades in place. The content inside slides the way the pointer went.
 */
export function DropdownDemo() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("one panel");
  const [nav, setNav] = useState<{
    active: number | null;
    prev: number | null;
    last: number | null;
  }>({ active: null, prev: null, last: null });
  const [spots, setSpots] = useState<{ left: number; width: number }[]>([]);
  const [room, setRoom] = useState(0);
  const [heights, setHeights] = useState<number[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const copies = useRef<(HTMLDivElement | null)[]>([]);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const bar = useRef<HTMLElement>(null);
  const close = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      setRoom(el.clientWidth);
      /* item boxes relative to the nav, for the highlight. The panel adds the
         nav's own offset to centre itself under an item */
      setSpots(
        items.current.map((b) => ({
          left: b?.offsetLeft ?? 0,
          width: b?.offsetWidth ?? 0,
        })),
      );
      setHeights(copies.current.map((c) => c?.offsetHeight ?? 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    /* a late font changes a panel's height, so the copies are watched too */
    for (const c of copies.current) if (c) ro.observe(c);
    return () => {
      ro.disconnect();
      clearTimeout(close.current);
    };
  }, []);

  const go = (next: number | null) => {
    clearTimeout(close.current);
    setNav((n) =>
      n.active === next
        ? n
        : { active: next, prev: n.active, last: next ?? n.active },
    );
  };
  const leave = () => {
    clearTimeout(close.current);
    close.current = setTimeout(() => go(null), 140);
  };

  const { active, prev, last } = nav;
  const place = (i: number) => {
    const w = Math.min(NAV[i].w, room);
    const s = spots[i];
    const centre =
      (bar.current?.offsetLeft ?? 0) + (s ? s.left + s.width / 2 : 0);
    const x = Math.max(0, Math.min(centre - w / 2, room - w));
    return { x, width: w, height: heights[i] ?? 0 };
  };
  const dir = active !== null && prev !== null && active < prev ? -1 : 1;
  const fromClosed = prev === null;
  /* opening from nothing lands in place, since there is nowhere to travel from */
  const travel = reduce || fromClosed ? { duration: 0 } : SHARED;
  /* a closing highlight fades where it was, rather than sliding to the start */
  const spot = spots[active ?? last ?? 0];
  /* in the comparison mode the highlight steps, as each panel does */
  const slide = mode === "one panel" ? travel : { duration: 0 };

  return (
    <Frame
      hint="Hover across the items. Switch the mode to compare."
      controls={
        <Cycle
          value={mode}
          options={MODES}
          onChange={(m) => {
            setMode(m);
            go(null);
          }}
          label="Dropdown mode"
        />
      }
      className="justify-start"
    >
      <div
        ref={box}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") leave();
        }}
        onPointerEnter={() => clearTimeout(close.current)}
        className="relative mx-auto h-64 w-full max-w-110"
      >
        {/* one hidden copy of each panel at its width, so a panel is exactly
            as tall as what is in it */}
        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute"
        >
          {NAV.map((n, i) => (
            <div
              key={n.name}
              ref={(el) => {
                copies.current[i] = el;
              }}
              className="absolute top-0 left-0"
              style={{ width: n.w }}
            >
              <Content index={i} />
            </div>
          ))}
        </div>
        <nav
          ref={bar}
          className={cn(
            "relative mx-auto flex w-fit gap-1 rounded-full p-1",
            RAISED,
          )}
        >
          {/* one highlight that slides between items on the panel's spring,
              rather than a fill on each item that blinks */}
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{
              x: spot?.left ?? 0,
              width: spot?.width ?? 0,
              opacity: active === null ? 0 : 1,
            }}
            transition={{ ...slide, opacity: { duration: 0.12 } }}
            className="absolute top-1 left-0 h-8 rounded-full bg-fill"
          />
          {NAV.map((n, i) => (
            <button
              key={n.name}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              aria-expanded={active === i}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") go(i);
              }}
              onClick={() => go(active === i ? null : i)}
              className="relative h-8 cursor-pointer rounded-full px-3 pb-[0.16em] text-body text-text-secondary transition-colors duration-150 hover:text-text-primary aria-expanded:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              {n.name}
            </button>
          ))}
        </nav>
        {mode === "one panel" ? (
          <AnimatePresence>
            {active === null ? null : (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: -4, ...place(active) }}
                animate={{ opacity: 1, y: 0, ...place(active) }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                transition={{
                  ...travel,
                  opacity: { duration: 0.15 },
                  y: { duration: 0.15, ease: "easeOut" },
                }}
                className={cn(
                  "absolute top-12 left-0 overflow-hidden rounded-lg",
                  RAISED,
                )}
              >
                <AnimatePresence initial={false} custom={dir} mode="popLayout">
                  <motion.div
                    key={active}
                    custom={dir}
                    /* the slide rides the panel's spring, and the fade is
                       quicker, so the swap is done before the box lands */
                    variants={{
                      in: (d: number) => ({
                        opacity: 0,
                        x: reduce ? 0 : d * 24,
                      }),
                      at: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          ...SHARED,
                          opacity: { duration: 0.16, ease: "easeOut" },
                        },
                      },
                      out: (d: number) => ({
                        opacity: 0,
                        x: reduce ? 0 : d * -24,
                        transition: {
                          ...SHARED,
                          opacity: { duration: 0.1, ease: "easeIn" },
                        },
                      }),
                    }}
                    initial="in"
                    animate="at"
                    exit="out"
                    className="absolute top-0 left-0"
                    style={{ width: Math.min(NAV[active].w, room) }}
                  >
                    <Content index={active} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <AnimatePresence>
            {active === null ? null : (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "absolute top-12 left-0 overflow-hidden rounded-lg",
                  RAISED,
                )}
                style={place(active)}
              >
                <Content index={active} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </Frame>
  );
}
