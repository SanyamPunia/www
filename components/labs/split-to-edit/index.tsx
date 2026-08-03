"use client";

import { LayoutGroup, motion, useAnimationControls } from "motion/react";
import { Poppins } from "next/font/google";
import { useRef, useState } from "react";
import { CheckSm } from "./icons/check";
import { PencilSolid } from "./icons/pencil";
import "./styles.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const page = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [bordersSettled, setBordersSettled] = useState(true);
  const borderTimerRef = useRef<number | null>(null);
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("0");
  /*
   * What is currently typed, mirrored into state on every input.
   *
   * This used to read the two fields back off refs at commit time, but
   * `motion.span` does not forward a ref, so `ref.current` was always null,
   * every commit read two empty strings, and the guard refused as "both fields
   * blank" no matter what was on screen. `e.currentTarget` is the DOM node
   * itself and cannot be null inside its own handler, which is why the typing
   * and paste guards were unaffected.
   *
   * The spans stay uncontrolled: their React children are `hours`/`minutes`,
   * which do not change while editing, so React never rewrites the text and
   * the caret survives. Rendering the draft here instead would reset the caret
   * to the start on every keystroke.
   */
  const [draftHours, setDraftHours] = useState("0");
  const [draftMinutes, setDraftMinutes] = useState("0");

  /*
   * Clearing both fields and confirming would commit 0 hr. 0 min., which is
   * not a duration. The confirm is refused instead of silently coercing, so
   * the state the user is looking at is the state that gets saved.
   *
   * `isInvalid` is only ever set by a refused confirm, never while typing. An
   * empty field mid-edit is a normal thing to pass through on the way to a new
   * value, and colouring it red as you clear it would be scolding.
   */
  const [isInvalid, setIsInvalid] = useState(false);
  const shakeControls = useAnimationControls();

  // the moment either field changes, the refusal no longer describes what is
  // on screen, so it clears rather than waiting for a second confirm
  const clearInvalid = () => setIsInvalid(false);

  const getDigits = (text: string) => text.replace(/\D/g, "");
  const clamp = (num: number, min: number, max: number) =>
    Math.max(min, Math.min(max, num));

  /*
   * The clamp below only runs on commit, so without these guards a field
   * accepts unlimited characters while you type and the pills grow until they
   * overlap each other. Capped at the digit count each range actually needs,
   * so nothing can outgrow its pill in the first place.
   */
  const MAX_DIGITS = { hours: 3, minutes: 2 } as const;

  const guardDigits =
    (max: number) => (e: React.KeyboardEvent<HTMLSpanElement>) => {
      // cleared here as well as on `onInput`, so a Backspace that empties the
      // last character still drops the red immediately
      clearInvalid();

      if (e.key === "Enter") {
        e.preventDefault();
        return;
      }
      // navigation, deletion and shortcuts all pass through untouched
      if (e.key.length > 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/\d/.test(e.key)) {
        e.preventDefault();
        return;
      }
      // a selection is about to be replaced, so it does not count toward the cap
      const selection = window.getSelection();
      const replacing = selection ? !selection.isCollapsed : false;
      // `textContent`, not `innerText`: innerText is layout-dependent and
      // these spans are inside a Motion layout animation
      const current = getDigits(e.currentTarget.textContent || "");
      if (!replacing && current.length >= max) {
        e.preventDefault();
      }
    };

  /*
   * Paste bypasses keydown entirely, so it needs the same cap applied.
   *
   * Written against Range rather than `document.execCommand("insertText")`,
   * which is deprecated. The manual version has to put the caret back itself:
   * `insertText` left it after the inserted run, and without the collapse
   * below the caret jumps to the start of the field on every paste.
   */
  const guardPaste =
    (max: number, setDraft: (value: string) => void) =>
    (e: React.ClipboardEvent<HTMLSpanElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      const room = max - getDigits(el.textContent || "").length;
      if (room <= 0) return;

      const pasted = getDigits(e.clipboardData.getData("text")).slice(0, room);
      if (!pasted) return;

      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(pasted);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // a programmatic insertNode fires no `input` event, so the draft has to
      // be updated by hand or a pasted value never reaches the commit
      clearInvalid();
      setDraft(getDigits(el.textContent || ""));
    };

  // mirrors the field into state after any real edit: typing, delete, cut,
  // drag-drop, autocorrect. Paste is the one path that has to do it manually.
  const handleInput =
    (setDraft: (value: string) => void) =>
    (e: React.FormEvent<HTMLSpanElement>) => {
      clearInvalid();
      setDraft(getDigits(e.currentTarget.textContent || ""));
    };

  const commitEdits = () => {
    setHours(
      draftHours === "" ? "0" : String(clamp(parseInt(draftHours, 10), 0, 999)),
    );
    setMinutes(
      draftMinutes === ""
        ? "0"
        : String(clamp(parseInt(draftMinutes, 10), 0, 59)),
    );
  };

  const settleBordersAfter = (ms = 150) => {
    setBordersSettled(false);
    if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
    borderTimerRef.current = window.setTimeout(() => {
      setBordersSettled(true);
      borderTimerRef.current = null;
    }, ms);
  };

  /*
   * A short, decaying horizontal wobble. Amplitude falls 4 -> 3 -> 1.5 -> 0
   * rather than repeating evenly, which is what makes it read as a physical
   * knock instead of a loop. It stays on one axis: a shake that also moves
   * vertically reads as a wiggle, not a refusal.
   *
   * MotionProvider sets reducedMotion="user", so this is skipped entirely for
   * anyone with the OS setting on. The red text is the channel that carries
   * the error for them, which is why the colour is not decoration.
   */
  const rejectConfirm = () => {
    setIsInvalid(true);
    shakeControls.start({
      x: [0, -4, 4, -3, 3, -1.5, 1.5, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  };

  const handlePencilClick = () => {
    if (isEditing) {
      /*
       * Both fields blank, and only that. `0` is a real value a user can mean
       * to enter, so it commits like any other. This is deliberately not a
       * zero-total check: `0 hr. 0 min.` is the state the control opens in and
       * refusing it would mean the control cannot be closed without editing.
       *
       * Refuse and stay in edit mode, so the fields keep their content and
       * the caret stays where it was.
       */
      if (draftHours === "" && draftMinutes === "") {
        rejectConfirm();
        return;
      }

      setIsInvalid(false);
      commitEdits();
      settleBordersAfter(150);
    } else {
      // seed the drafts from what is committed, so confirming without typing
      // saves the current value rather than whatever the last edit left behind
      setDraftHours(hours);
      setDraftMinutes(minutes);
    }
    setIsEditing((v) => !v);
  };

  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div
        className={`flex flex-col items-center justify-center ${poppins.className}`}
      >
        <LayoutGroup>
          {isEditing ? (
            <div className="flex flex-row items-center gap-6">
              <motion.div
                layout
                layoutId="seg-hr"
                className="text-body font-semibold bg-surface rounded-xl h-12 min-w-20 flex items-center justify-center gap-1 px-4"
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span
                  layout
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onKeyDown={guardDigits(MAX_DIGITS.hours)}
                  onPaste={guardPaste(MAX_DIGITS.hours, setDraftHours)}
                  onInput={handleInput(setDraftHours)}
                  className={`outline-none focus:outline-none focus:ring-0 ${
                    isInvalid ? "text-danger" : "text-text-primary"
                  }`}
                >
                  {hours}
                </motion.span>
                <motion.span
                  layout
                  className={isInvalid ? "text-danger" : "text-text-secondary"}
                >
                  Hr.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-min"
                className="text-body font-semibold bg-surface rounded-xl h-12 min-w-21 flex items-center justify-center gap-1 px-4"
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span
                  layout
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onKeyDown={guardDigits(MAX_DIGITS.minutes)}
                  onPaste={guardPaste(MAX_DIGITS.minutes, setDraftMinutes)}
                  onInput={handleInput(setDraftMinutes)}
                  className={`outline-none focus:outline-none focus:ring-0 ${
                    isInvalid ? "text-danger" : "text-text-primary"
                  }`}
                >
                  {minutes}
                </motion.span>
                <motion.span
                  layout
                  className={isInvalid ? "text-danger" : "text-text-secondary"}
                >
                  Min.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-icon"
                className="bg-surface rounded-xl h-12 w-16 flex items-center justify-center px-4 cursor-pointer"
                onClick={handlePencilClick}
              >
                {/*
                 * Two wrappers, because the shake and the entrance fade both
                 * want `animate` and one element only has one. The outer runs
                 * the shake off imperative controls, the inner keeps the fade.
                 * The shake is not on `seg-icon` itself: that carries the
                 * `layoutId`, and driving `x` on a layout-animated element
                 * fights the layout projection.
                 */}
                <motion.div animate={shakeControls}>
                  <motion.div
                    key="check"
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <CheckSm
                      className={`size-4 transition-colors duration-150 ${
                        isInvalid ? "text-danger" : "text-text-secondary"
                      }`}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          ) : (
            /*
             * No outline on either state. `seg-hr` used to carry a ring on its
             * own, which showed on three sides and stopped where `seg-min`
             * overlapped it, and the editing state has never had one. The
             * `bg-surface` fill is what defines the bar. Do not add a ring back
             * to one segment, that is the discrepancy this removed.
             */
            <div className="flex flex-row items-center">
              <motion.div
                layout
                layoutId="seg-hr"
                className={`text-body font-semibold bg-surface h-12 px-4 -mr-3 flex items-center justify-center gap-0.5 ${
                  bordersSettled ? "rounded-l-xl" : "rounded-xl"
                }`}
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span layout className="text-text-primary">
                  {hours || "0"}
                </motion.span>
                <motion.span className="text-text-secondary" layout>
                  Hr.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-min"
                className={`text-body font-semibold bg-surface h-12 px-4 -mr-3 flex items-center justify-between space-x-0.5 ${
                  bordersSettled ? "" : "rounded-xl"
                }`}
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span layout className="text-text-primary">
                  {minutes === "" ? "0" : minutes}
                </motion.span>
                <motion.span className="text-text-secondary" layout>
                  Min.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-icon"
                className={`bg-surface h-12 px-4 cursor-pointer flex items-center justify-center ${
                  bordersSettled ? "rounded-r-xl" : "rounded-xl"
                }`}
                onClick={handlePencilClick}
              >
                <motion.div
                  key="pencil"
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <PencilSolid className="size-4 text-text-secondary" />
                </motion.div>
              </motion.div>
            </div>
          )}
        </LayoutGroup>
      </div>
    </div>
  );
};

export default page;
