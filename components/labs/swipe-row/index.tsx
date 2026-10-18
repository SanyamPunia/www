"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { INBOX, type Message } from "./mail";
import { Row } from "./row";
import type { Side } from "./swipe";
import { click } from "./swipe-sound";

/*
 * An inbox you swipe, the way Mail does. `swipe.ts` is the numbers, `row.tsx`
 * one row and its gesture, `mail.ts` the messages and the hues. This file is
 * the list: which row is open, what was deleted, and the undo.
 *
 * Only one row is open at a time, so the list owns that and a row asks for it.
 * A press anywhere else closes the open row, which is what Mail does.
 */

interface Open {
  id: string;
  side: Side;
}

interface Deleted {
  msg: Message;
  index: number;
}

/** how long the undo stays offered, and how long an empty inbox waits */
const UNDO_MS = 4000;
const REFILL_MS = 900;

const ROW = { type: "spring", bounce: 0, visualDuration: 0.32 } as const;

export default function SwipeRow() {
  const stage = useRef<HTMLDivElement>(null);
  const undoTimer = useRef(0);
  const refillTimer = useRef(0);
  const reduce = useReducedMotion() ?? false;

  const [list, setList] = useState<Message[]>(() =>
    INBOX.map((m) => ({ ...m })),
  );
  const [open, setOpen] = useState<Open | null>(null);
  const [deleted, setDeleted] = useState<Deleted | null>(null);
  /** the row back from an undo, which enters from the side it left by */
  const [returning, setReturning] = useState<string | null>(null);
  /** the whole inbox coming back, staggered */
  const [refilled, setRefilled] = useState(false);
  const [message, setMessage] = useState("");
  /** the row showing the gesture once, the first time the list is seen */
  const [peek, setPeek] = useState<string | null>(null);

  const openRef = useRef(open);
  openRef.current = open;
  const listRef = useRef(list);
  listRef.current = list;

  const setSide = useCallback((id: string, side: Side | null) => {
    setOpen((o) => (side ? { id, side } : o?.id === id ? null : o));
  }, []);

  /** a press on a row closes any other open row, and says so */
  const onPress = useCallback((id: string) => {
    const o = openRef.current;
    if (o && o.id !== id) {
      setOpen(null);
      return true;
    }
    return false;
  }, []);

  const onCarry = useCallback((on: boolean) => {
    const el = stage.current;
    if (el) el.dataset.carry = on ? "true" : "false";
  }, []);

  const onRead = useCallback((id: string, unread: boolean) => {
    setList((l) => l.map((m) => (m.id === id ? { ...m, unread } : m)));
    setMessage(unread ? "Marked as unread." : "Marked as read.");
  }, []);

  const onFlag = useCallback((id: string) => {
    setList((l) =>
      l.map((m) => (m.id === id ? { ...m, flagged: !m.flagged } : m)),
    );
  }, []);

  const onDelete = useCallback((id: string, byKey: boolean) => {
    const l = listRef.current;
    const index = l.findIndex((m) => m.id === id);
    if (index < 0) return;
    setDeleted({ msg: l[index], index });
    setReturning(null);
    setList(l.filter((m) => m.id !== id));
    // the keyboard lands on the row that slides up into the gap
    const next = l[index + 1] ?? l[index - 1];
    if (byKey && next)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-row="${next.id}"]`)?.focus(),
      );
    setOpen((o) => (o?.id === id ? null : o));
    setMessage("Moved to trash. Undo is available.");
  }, []);

  const undo = useCallback(() => {
    if (!deleted) return;
    clearTimeout(undoTimer.current);
    const { msg, index } = deleted;
    setReturning(msg.id);
    setRefilled(false);
    setList((l) => {
      const next = [...l];
      next.splice(Math.min(index, next.length), 0, msg);
      return next;
    });
    setDeleted(null);
    click();
    setMessage("Restored.");
  }, [deleted]);

  // the undo goes after a while, and pauses while the pointer is on it
  const paused = useRef(false);
  useEffect(() => {
    if (!deleted) return;
    const tick = () => {
      undoTimer.current = window.setTimeout(() => {
        if (paused.current) tick();
        else setDeleted(null);
      }, UNDO_MS);
    };
    tick();
    return () => clearTimeout(undoTimer.current);
  }, [deleted]);

  // an empty inbox fills itself again, since this is a demo of a gesture
  useEffect(() => {
    if (list.length > 0 || deleted) return;
    refillTimer.current = window.setTimeout(() => {
      setReturning(null);
      setRefilled(true);
      setList(INBOX.map((m) => ({ ...m })));
    }, REFILL_MS);
    return () => clearTimeout(refillTimer.current);
  }, [list.length, deleted]);

  // Cmd or Ctrl and Z undoes, the way it does in Mail
  useEffect(() => {
    if (!deleted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "z" || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      const el = stage.current;
      if (!el?.matches(":hover") && !el?.contains(document.activeElement))
        return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleted, undo]);

  // the first time the list is mostly on screen, the top row peeks once
  useEffect(() => {
    const el = stage.current;
    if (!el || reduce) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          setPeek(listRef.current[0]?.id ?? null);
          timer = window.setTimeout(() => setPeek(null), 1400);
        }, 700);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [reduce]);

  // a press on bare stage closes the open row
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-row-list]")) setOpen(null);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <div
      ref={stage}
      className={cn(
        "relative flex aspect-8/5 min-h-96 w-full select-none flex-col items-center justify-center overflow-hidden rounded-lg bg-fill",
        "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
      )}
    >
      {/* a fixed box for the list, so the card shrinks upward as rows go
          rather than re-centring under the hand */}
      <div className="h-72 w-[min(22rem,calc(100%-2rem))]">
        <div
          data-row-list
          className="overflow-hidden rounded-[1.25rem] bg-bg"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
          }}
        >
          <ul aria-label="Inbox">
            <AnimatePresence initial={false}>
              {list.map((m, i) => (
                <motion.li
                  key={m.id}
                  className="overflow-hidden"
                  initial={
                    refilled
                      ? { height: 0, opacity: 0 }
                      : { height: 0, opacity: 1 }
                  }
                  animate={{ height: "auto", opacity: 1 }}
                  // a tween, so the gap is gone when it looks gone: a spring's
                  // tail kept the node for half a second of nothing
                  exit={{
                    height: 0,
                    transition: reduce
                      ? { duration: 0 }
                      : { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
                  }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { ...ROW, delay: refilled ? i * 0.05 : 0 }
                  }
                >
                  <Row
                    msg={m}
                    side={open?.id === m.id ? open.side : null}
                    last={i === list.length - 1}
                    reduce={reduce}
                    returning={returning === m.id}
                    peek={peek === m.id}
                    setSide={setSide}
                    onPress={onPress}
                    onCarry={onCarry}
                    onRead={onRead}
                    onFlag={onFlag}
                    onDelete={onDelete}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>

      {/* the undo, the way Mail offers one after a trash */}
      <AnimatePresence>
        {deleted && (
          <motion.div
            key="undo"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ type: "spring", bounce: 0, visualDuration: 0.25 }}
            onPointerEnter={() => {
              paused.current = true;
            }}
            onPointerLeave={() => {
              paused.current = false;
            }}
            className="absolute bottom-4 flex h-9 items-center gap-1 rounded-full bg-text-primary pr-1 pl-4 text-meta"
            style={{ color: "#fff" }}
          >
            <span>Moved to trash</span>
            <button
              type="button"
              onClick={undo}
              className="cursor-pointer rounded-full px-3 py-1.5 font-medium transition-colors duration-200 hover:bg-bg/10 active:bg-bg/20 active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/40"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p id="swipe-row-help" className="sr-only">
        Swipe left for flag and delete, or right to mark as read. A long swipe
        does the action. With a keyboard, press the left or right arrow to show
        the actions, or Delete to delete.
      </p>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
