"use client";

import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  CopyIcon,
  HeartIcon,
  HeartOutlineIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { armSound, buzz, click, thunk, tick } from "./haptic-sound";
import {
  CONFIRM_H,
  HEAD,
  HOLD,
  MENU_H,
  MENU_W,
  NOTE,
  type Pose,
  pose,
  type Rect,
  ROW,
  SEP,
  SLOP,
  shrinkAt,
} from "./menu";
import { album, type Photo } from "./photos";

/*
 * The iOS long-press context menu, on an album of six drawn photos. Hold a
 * photo and it shrinks under the finger, then lifts out as a preview while
 * the album blurs behind it and a menu unfolds beside it. Keep the finger
 * down and slide onto an action to choose it in one gesture.
 *
 * `menu.ts` is the numbers and the layout, `photos.ts` the pictures and
 * `haptic-sound.ts` the sounds. This file is the press, the lift and the menu.
 *
 * One value, `press`, runs from 0 to 1 over the hold and drives both the
 * tile's shrink and the first part of the blur, so the album starts to go
 * soft before the photo has lifted and the lift reads as the press arriving.
 */

type Action = "favourite" | "rotate" | "copy" | "delete" | "confirm" | "cancel";

interface Lifted {
  id: string;
  pose: Pose;
  /** whether the keyboard opened it, so focus goes in and comes back */
  byKey: boolean;
  closing: boolean;
  /**
   * The menu leaves the moment an action is chosen, and the preview stays a
   * beat longer to show what the action did. Left up, a favourite renamed its
   * own row to "Unfavourite" while the menu was still on screen.
   */
  menu: boolean;
}

const LIFT = { type: "spring", bounce: 0.22, visualDuration: 0.38 } as const;
const HOME = { type: "spring", bounce: 0, visualDuration: 0.3 } as const;
const MENU_IN = { type: "spring", bounce: 0.25, visualDuration: 0.32 } as const;
/** the tile's corner and the preview's, so the lift grows its corner too */
const TILE_R = 10;
const PREVIEW_R = 16;
/** a favourite or a rotation shows on the preview before it goes home */
const SHOW_MS = 300;

export default function HapticMenu() {
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [photos, setPhotos] = useState<Photo[]>(album);
  const [held, setHeld] = useState<string | null>(null);
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [view, setView] = useState<"menu" | "confirm">("menu");
  const [hi, setHi] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const press = useMotionValue(0);
  const veil = useMotionValue(0);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const pw = useMotionValue(0);
  const ph = useMotionValue(0);
  const pr = useMotionValue(TILE_R);
  const pOpacity = useMotionValue(1);
  const pScale = useMotionValue(1);

  /** the pointer that is down on a tile, from the press to the release */
  const down = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    t: number;
    raf: number;
  } | null>(null);
  const liftedRef = useRef(lifted);
  liftedRef.current = lifted;
  const hiRef = useRef(hi);
  hiRef.current = hi;
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const toastTimer = useRef(0);

  const say = useCallback((text: string, visible: boolean) => {
    setStatus(text);
    if (!visible) return;
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const tileRect = useCallback((id: string): Rect | null => {
    const s = stage.current;
    const t = s?.querySelector<HTMLElement>(`[data-tile="${id}"]`);
    if (!s || !t) return null;
    const a = s.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
  }, []);

  const go = useCallback(
    (v: MotionValue<number>, to: number, spring: object) =>
      animate(v, to, reduceRef.current ? { duration: 0 } : spring),
    [],
  );

  const stopHold = useCallback(() => {
    const d = down.current;
    if (d) cancelAnimationFrame(d.raf);
  }, []);

  const lift = useCallback(
    (id: string, byKey: boolean) => {
      stopHold();
      const s = stage.current;
      const from = tileRect(id);
      if (!s || !from) return;
      const p = pose({ w: s.clientWidth, h: s.clientHeight }, from);
      px.set(from.x);
      py.set(from.y);
      pw.set(from.w);
      ph.set(from.h);
      pr.set(TILE_R);
      pOpacity.set(1);
      pScale.set(1);
      setView("menu");
      setHi(byKey ? 0 : null);
      setLifted({ id, pose: p, byKey, closing: false, menu: true });
      setHeld(null);
      press.set(0);
      go(px, p.preview.x, LIFT);
      go(py, p.preview.y, LIFT);
      go(pw, p.preview.w, LIFT);
      go(ph, p.preview.h, LIFT);
      go(pr, PREVIEW_R, LIFT);
      animate(veil, 1, { duration: reduceRef.current ? 0 : 0.22 });
      thunk();
      buzz(12);
    },
    [stopHold, tileRect, go, px, py, pw, ph, pr, pOpacity, pScale, press, veil],
  );

  const close = useCallback(() => {
    const l = liftedRef.current;
    if (!l || l.closing) return;
    setLifted({ ...l, closing: true });
    setHi(null);
    animate(veil, 0, { duration: reduceRef.current ? 0 : 0.2 });
    const home = photosRef.current.some((p) => p.id === l.id)
      ? tileRect(l.id)
      : null;
    const done = () => {
      setLifted(null);
      setView("menu");
      if (l.byKey)
        stage.current
          ?.querySelector<HTMLElement>(`[data-tile="${l.id}"]`)
          ?.focus();
    };
    if (!home) {
      // the photo was deleted, so there is no slot to go back to
      go(pScale, 0.85, HOME);
      animate(pOpacity, 0, { duration: reduceRef.current ? 0 : 0.2 }).then(
        done,
      );
      return;
    }
    go(px, home.x, HOME);
    go(py, home.y, HOME);
    go(pw, home.w, HOME);
    go(pr, TILE_R, HOME);
    go(ph, home.h, HOME).then(done);
  }, [tileRect, go, px, py, pw, ph, pr, pOpacity, pScale, veil]);

  const choose = useCallback(
    (action: Action) => {
      const l = liftedRef.current;
      if (!l || l.closing) return;
      const photo = photosRef.current.find((p) => p.id === l.id);
      if (!photo) return;
      click();
      buzz(6);
      const later = (fn: () => void) => {
        setLifted({ ...l, menu: false });
        setHi(null);
        window.setTimeout(fn, reduceRef.current ? 0 : SHOW_MS);
      };
      if (action === "favourite") {
        setPhotos((ps) =>
          ps.map((p) =>
            p.id === l.id ? { ...p, favourite: !p.favourite } : p,
          ),
        );
        say(
          photo.favourite
            ? `Removed “${photo.title}” from favourites.`
            : `Added “${photo.title}” to favourites.`,
          false,
        );
        later(close);
      } else if (action === "rotate") {
        setPhotos((ps) =>
          ps.map((p) => (p.id === l.id ? { ...p, turns: p.turns + 1 } : p)),
        );
        say(`Rotated “${photo.title}”.`, false);
        later(close);
      } else if (action === "copy") {
        void navigator.clipboard?.writeText(photo.title).catch(() => {});
        say(`Copied “${photo.title}”`, true);
        close();
      } else if (action === "delete") {
        setView("confirm");
        setHi(l.byKey ? 0 : null);
      } else if (action === "cancel") {
        setView("menu");
        setHi(l.byKey ? 3 : null);
      } else {
        setPhotos((ps) => ps.filter((p) => p.id !== l.id));
        say(`Deleted “${photo.title}”`, true);
        // the grid reflows under the blur, then the preview goes
        requestAnimationFrame(close);
      }
    },
    [close, say],
  );

  const items: { action: Action; label: string; danger?: boolean }[] =
    view === "menu"
      ? [
          {
            action: "favourite",
            label: photos.find((p) => p.id === lifted?.id)?.favourite
              ? "Unfavourite"
              : "Favourite",
          },
          { action: "rotate", label: "Rotate" },
          { action: "copy", label: "Copy title" },
          { action: "delete", label: "Delete", danger: true },
        ]
      : [
          { action: "confirm", label: "Delete photo", danger: true },
          { action: "cancel", label: "Cancel" },
        ];
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // keyboard focus follows the highlight, so the arrows walk the menu
  useEffect(() => {
    if (!lifted?.byKey || lifted.closing || hi === null) return;
    stage.current
      ?.querySelector<HTMLElement>(`[data-item="${hi}"]`)
      ?.focus({ preventScroll: true });
  }, [lifted, hi]);

  // Escape closes, from anywhere on the page
  useEffect(() => {
    if (!lifted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lifted, close]);

  // a finger sliding onto the menu would scroll the page, so once the photo
  // has lifted the touch is the menu's. Bound by hand, since a listener that
  // cancels cannot be passive
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (liftedRef.current && down.current) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  // a resize closes at once, since the pose was laid out for the old stage
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w) return;
      w = el.clientWidth;
      if (!liftedRef.current) return;
      veil.set(0);
      setLifted(null);
      setView("menu");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [veil]);

  const onDown = (e: React.PointerEvent, id: string) => {
    if (liftedRef.current || e.button !== 0) return;
    armSound();
    e.currentTarget.setPointerCapture(e.pointerId);
    const t0 = performance.now();
    const d = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, t: t0 };
    setHeld(id);
    const step = (now: number) => {
      const p = (now - t0) / 1000 / HOLD;
      if (!reduceRef.current) press.set(p);
      veil.set(Math.min(1, p) * 0.35);
      if (p >= 1) {
        lift(id, false);
        return;
      }
      if (down.current) down.current.raf = requestAnimationFrame(step);
    };
    down.current = { ...d, raf: requestAnimationFrame(step) };
  };

  const release = (tap: boolean) => {
    const d = down.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    down.current = null;
    if (liftedRef.current) return;
    setHeld(null);
    animate(press, 0, { duration: 0.18, ease: [0.23, 1, 0.32, 1] });
    animate(veil, 0, { duration: 0.18 });
    if (tap) say("Press and hold a photo", true);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d || d.pointer !== e.pointerId) return;
    const l = liftedRef.current;
    if (!l) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SLOP) release(false);
      return;
    }
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-item]");
    const next = hit ? Number(hit.dataset.item) : null;
    if (next !== hiRef.current) {
      setHi(next);
      if (next !== null) {
        tick();
        buzz(4);
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d || d.pointer !== e.pointerId) return;
    const l = liftedRef.current;
    if (!l) {
      release((performance.now() - d.t) / 1000 < HOLD);
      return;
    }
    down.current = null;
    // a finger that slid onto an action chooses it on the way up. One that
    // let go anywhere else leaves the menu open, the way iOS does
    const i = hiRef.current;
    if (i !== null) choose(itemsRef.current[i].action);
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const n = itemsRef.current.length;
    const at = hiRef.current ?? -1;
    const to =
      e.key === "ArrowDown"
        ? (at + 1) % n
        : e.key === "ArrowUp"
          ? (at - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (to !== null) {
      e.preventDefault();
      setLifted((l) => (l ? { ...l, byKey: true } : l));
      setHi(to);
    } else if (e.key === "Tab") {
      e.preventDefault();
      close();
    }
  };

  // a deleted photo keeps its last picture, so its preview can fade out
  const lastPhoto = useRef<Photo | null>(null);
  const photo = photos.find((p) => p.id === lifted?.id) ?? lastPhoto.current;
  if (lifted && photo) lastPhoto.current = photo;

  return (
    <div
      ref={stage}
      className="relative flex h-[25rem] w-full touch-pan-y select-none items-center justify-center overflow-hidden rounded-lg bg-fill [-webkit-touch-callout:none]"
    >
      <ul
        aria-label="Album"
        className="grid w-[min(21rem,calc(100%-3rem))] grid-cols-3 gap-3"
      >
        <AnimatePresence initial={false}>
          {photos.map((p) => (
            <Tile
              key={p.id}
              photo={p}
              held={held === p.id}
              hidden={lifted?.id === p.id}
              press={press}
              reduce={reduce}
              onPointerDown={(e) => onDown(e, p.id)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={(e) => {
                if (down.current?.pointer === e.pointerId) release(false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!liftedRef.current) lift(p.id, false);
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" ||
                  e.key === " " ||
                  e.key === "ContextMenu" ||
                  (e.key === "F10" && e.shiftKey)
                ) {
                  e.preventDefault();
                  armSound();
                  lift(p.id, true);
                }
              }}
              onClick={(e) => {
                // an assistive technology's click cannot be held
                if (e.detail === 0 && !liftedRef.current) lift(p.id, true);
              }}
            />
          ))}
        </AnimatePresence>
      </ul>

      {/* the blur over the album. Its own button, so a press off the menu
          closes it, and out of the tab order, since Escape is the keyboard's */}
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
        style={{ opacity: veil }}
        className={cn(
          "absolute inset-0 z-10 cursor-default bg-fill/40 backdrop-blur-md",
          lifted ? "pointer-events-auto" : "pointer-events-none",
        )}
      />

      {lifted && photo ? (
        <motion.button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={close}
          className="absolute z-30 cursor-default overflow-hidden"
          style={{
            left: px,
            top: py,
            width: pw,
            height: ph,
            borderRadius: pr,
            opacity: pOpacity,
            scale: pScale,
            boxShadow:
              "0 2px 6px rgba(0,0,0,0.08), 0 24px 48px -12px rgba(0,0,0,0.3)",
          }}
        >
          <Art photo={photo} />
        </motion.button>
      ) : null}

      <AnimatePresence>
        {lifted && !lifted.closing && lifted.menu && photo ? (
          <motion.div
            key="menu"
            role="menu"
            aria-label={photo.title}
            onKeyDown={onMenuKey}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.4, filter: "blur(4px)" }
            }
            animate={{
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              height: view === "menu" ? MENU_H : CONFIRM_H,
            }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    scale: 0.9,
                    transition: { duration: 0.14, ease: "easeIn" },
                  }
            }
            transition={reduce ? { duration: 0 } : MENU_IN}
            className="absolute z-40 overflow-hidden rounded-[14px] bg-bg/90 backdrop-blur-xl"
            style={{
              left: lifted.pose.menu.x,
              top: lifted.pose.menu.y,
              width: MENU_W,
              transformOrigin: lifted.pose.origin,
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.06), 0 18px 40px -10px rgba(0,0,0,0.28)",
            }}
          >
            <div
              className="flex items-center border-stroke-soft border-b px-4 text-meta text-text-secondary"
              style={{ height: HEAD }}
            >
              <span className="truncate">
                {view === "menu" ? photo.title : `Delete “${photo.title}”?`}
              </span>
            </div>
            {view === "confirm" ? (
              <p
                className="flex items-center px-4 text-meta text-text-secondary"
                style={{ height: NOTE }}
              >
                You can restore it later.
              </p>
            ) : null}
            {items.map((item, i) => (
              <div key={`${view}-${item.action}`}>
                {view === "menu" && i === 3 ? (
                  <div className="bg-fill" style={{ height: SEP }} />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  data-item={i}
                  tabIndex={hi === i ? 0 : -1}
                  onClick={() => choose(item.action)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse" && !down.current) setHi(i);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse" && !down.current) setHi(null);
                  }}
                  style={{ height: ROW }}
                  data-active={hi === i || undefined}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 px-4 text-body transition-colors duration-150 focus-visible:outline-none",
                    "data-[active]:bg-fill-hover data-[active]:duration-0 active:bg-fill-active",
                    (view === "confirm" || (i !== 0 && i !== 3)) &&
                      "border-stroke-soft border-t",
                    item.danger ? "text-danger" : "text-text-primary",
                  )}
                >
                  <span>{item.label}</span>
                  <ItemIcon action={item.action} favourite={photo.favourite} />
                </button>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {photos.length < 6 && !lifted ? (
          <motion.div
            key="restore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3 z-20"
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip label="Restore photos">
                <button
                  type="button"
                  aria-label="Restore photos"
                  onClick={() => {
                    setPhotos((ps) =>
                      album().map((a) => ps.find((p) => p.id === a.id) ?? a),
                    );
                    say("Photos restored.", false);
                  }}
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                    // one step up from the site's order, since it sits on a
                    // `fill` ground where `bg-fill` would be invisible
                    "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
                  )}
                >
                  <ArrowCounterClockwiseIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </button>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none absolute bottom-4 z-50 rounded-full bg-text-primary px-3 py-1.5 text-meta"
            style={{ color: "#fff" }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <span id="haptic-menu-help" className="sr-only">
        Press and hold, or press Enter, for actions.
      </span>
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-50 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}

function ItemIcon({
  action,
  favourite,
}: {
  action: Action;
  favourite: boolean;
}) {
  const cls = "size-4 shrink-0";
  if (action === "favourite")
    return favourite ? (
      <HeartIcon aria-hidden="true" className={cls} />
    ) : (
      <HeartOutlineIcon aria-hidden="true" className={cls} />
    );
  if (action === "rotate")
    return <ArrowsClockwiseIcon aria-hidden="true" className={cls} />;
  if (action === "copy") return <CopyIcon aria-hidden="true" className={cls} />;
  if (action === "cancel") return <XIcon aria-hidden="true" className={cls} />;
  return <TrashIcon aria-hidden="true" className={cls} />;
}

/** a photo's picture, turned by its quarter turns, with its favourite mark */
function Art({ photo }: { photo: Photo }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{
          background: photo.art,
          transform: `rotate(${photo.turns * 90}deg)`,
        }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-opacity duration-200",
          photo.favourite ? "opacity-100" : "opacity-0",
        )}
        style={{ color: "#fff" }}
      >
        <HeartIcon className="size-3" />
      </span>
    </>
  );
}

function Tile({
  photo,
  held,
  hidden,
  press,
  reduce,
  ...handlers
}: {
  photo: Photo;
  held: boolean;
  hidden: boolean;
  press: MotionValue<number>;
  reduce: boolean;
} & Pick<
  React.ComponentProps<"button">,
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onContextMenu"
  | "onKeyDown"
  | "onClick"
>) {
  const shrink = useTransform(press, shrinkAt);
  return (
    <motion.li
      layout={!reduce}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={reduce ? { duration: 0 } : HOME}
      className={cn("relative aspect-square", held && "z-20")}
    >
      <motion.button
        type="button"
        data-tile={photo.id}
        aria-label={`${photo.title}${photo.favourite ? ", favourite" : ""}`}
        aria-haspopup="menu"
        aria-describedby="haptic-menu-help"
        {...handlers}
        style={{ scale: held ? shrink : 1, opacity: hidden ? 0 : 1 }}
        className="relative block size-full cursor-pointer overflow-hidden rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill"
      >
        <Art photo={photo} />
      </motion.button>
    </motion.li>
  );
}
