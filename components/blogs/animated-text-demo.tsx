"use client";

/**
 * Side-by-side demo for the stream-text post: raw incoming text against the
 * same text run through `useAnimatedText`.
 *
 * The hook and the corpus are the post's subject and are unchanged. Only the
 * chrome was relit, from the dark build's raw greys onto this project's
 * tokens and type scale.
 */

const BUTTON =
  "h-8 w-20 cursor-pointer rounded-full bg-fill text-meta text-text-primary transition-colors duration-200 hover:bg-fill-hover active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15";

import { animate, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";

const delay = 300;
const characters = 20;

export function AnimatedTextDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [text, setText] = useState("");
  const animatedText = useAnimatedText(text);

  useInterval(
    () => {
      const newText = getNextChars(characters);
      setText((text) => text + newText);
    },
    isPlaying ? delay : null,
  );

  return (
    /*
     * No `Demo` frame. The two panels already carry their own edge, so the
     * frame was a border around two borders, and its `p-6` held the panels off
     * the column so they never used the width they had. `my-6` is what the
     * frame was contributing that is still wanted: the MDX flow needs the
     * breathing room whether or not anything is drawing an outline.
     */
    <div className="my-6 flex w-full flex-col gap-4">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className={BUTTON}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setText("");
            setIsPlaying(false);
            position = 0;
          }}
          className={BUTTON}
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextDisplay title="Without Hook" content={text} />
        <TextDisplay title="With useAnimatedText Hook" content={animatedText} />
      </div>
    </div>
  );
}

function TextDisplay({ title, content }: { title: string; content: string }) {
  return (
    /*
     * The panel owns its edge. The inner scroller used to carry `bg-surface`,
     * which painted straight over the `ring-inset` on the sides and bottom and
     * left a rule that only appeared beside the label.
     *
     * `overflow-hidden` so the scroller clips to the radius instead of
     * squaring the corners off, and the surface sits on the outer element so
     * nothing can paint over the ring again.
     */
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-stroke ring-inset">
      <p className="px-3 pt-2 pb-1 text-meta text-text-muted">{title}</p>
      <div className="h-60 overflow-auto px-3 pb-3">
        <p className="whitespace-pre-wrap text-meta text-text-secondary">
          {content}
        </p>
      </div>
    </div>
  );
}

const delimiter = "";
function useAnimatedText(text: string) {
  const animatedCursor = useMotionValue(0);
  const [cursor, setCursor] = useState(0);
  const [prevText, setPrevText] = useState(text);
  const [isSameText, setIsSameText] = useState(true);

  if (prevText !== text) {
    setPrevText(text);
    setIsSameText(text.startsWith(prevText));

    if (!text.startsWith(prevText)) {
      setCursor(0);
    }
  }

  useEffect(() => {
    if (!isSameText) {
      animatedCursor.jump(0);
    }
    const controls = animate(animatedCursor, text.split(delimiter).length, {
      duration: 3,
      ease: "easeOut",
      onUpdate(latest) {
        setCursor(Math.floor(latest));
      },
    });

    return () => controls.stop();
  }, [animatedCursor, isSameText, text]);

  return text.split(delimiter).slice(0, cursor).join(delimiter);
}

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) {
      return;
    }

    savedCallback.current?.();

    function tick() {
      savedCallback.current?.();
    }

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}

let position = 0;
function getNextChars(n: number) {
  const result = greatGatsbyFull.slice(position, position + n);
  position += n;
  return result;
}

const greatGatsbyFull = `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.

"Whenever you feel like criticizing anyone," he told me, "just remember that all the people in this world haven't had the advantages that you've had."

He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgements, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores. The abnormal mind is quick to detect and attach itself to this quality when it appears in a normal person, and so it came about that in college I was unjustly accused of being a politician, because I was privy to the secret griefs of wild, unknown men. Most of the confidences were unsought—frequently I have feigned sleep, preoccupation, or a hostile levity when I realized by some unmistakable sign that an intimate revelation was quivering on the horizon; for the intimate revelations of young men, or at least the terms in which they express them, are usually plagiaristic and marred by obvious suppressions. Reserving judgements is a matter of infinite hope. I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth.`;
