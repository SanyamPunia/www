"use client";

import { useState, useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";
import { Button } from "@/components/ui/button";

const delay = 300;
const characters = 20;

export default function AnimatedTextDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [text, setText] = useState("");
  const animatedText = useAnimatedText(text);

  useInterval(
    () => {
      let newText = getNextChars(characters);
      setText((text) => text + newText);
    },
    isPlaying ? delay : null
  );

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="flex justify-center space-x-2">
        <Button
          onClick={() => setIsPlaying(!isPlaying)}
          variant="outline"
          size="sm"
          className="w-20 text-xs"
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          onClick={() => {
            setText("");
            setIsPlaying(false);
            position = 0;
          }}
          variant="outline"
          size="sm"
          className="w-20 text-xs"
        >
          Reset
        </Button>
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
    <div className="space-y-1 border border-border pt-2 rounded-md">
      <h2 className="text-xs font-medium text-neutral-400 px-2">{title}</h2>
      <div className="h-[300px] overflow-auto bg-neutral-900 p-3 rounded-b-md">
        <p className="whitespace-pre-wrap text-xs leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

let delimiter = "";
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
    let controls = animate(animatedCursor, text.split(delimiter).length, {
      duration: 3,
      ease: "easeOut",
      onUpdate(latest) {
        setCursor(Math.floor(latest));
      },
    });

    return () => controls.stop();
  }, [animatedCursor, isSameText, text.length]);

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
