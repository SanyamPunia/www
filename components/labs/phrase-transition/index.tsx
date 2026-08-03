"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import "./styles.css";

interface PhraseTransitionProps {
  phrases: string[];
  interval: number;
  className?: string;
}

const samplePhrases = [
  "analyzing your data...",
  "processing results...",
  "generating insights...",
  "almost done...",
  "finalizing output...",
];

function PhraseTransition({
  phrases,
  interval,
  className = "",
}: PhraseTransitionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!phrases || phrases.length <= 1) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
        setIsTransitioning(false);
      }, 100);
    }, interval);

    return () => clearInterval(timer);
  }, [phrases, interval]);

  const currentPhrase = phrases?.[currentIndex] || "";

  return (
    <div className={`inline-block ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhrase}
          initial={{ opacity: 0.05, y: 4 }}
          animate={{
            opacity: isTransitioning ? 0.05 : 1,
            y: isTransitioning ? -4 : 0,
          }}
          exit={{ opacity: 0.05, y: -4 }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          className="inline-block"
        >
          <ShinyText
            text={currentPhrase}
            disabled={false}
            speed={3}
            className="bg-fill text-body text-text-primary/40"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const ShinyText = ({
  text,
  disabled = false,
  speed = 5,
  className = "",
}: {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`inline-block bg-clip-text text-text-primary/20 ${
        disabled ? "" : "animate-shine"
      } ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        animationDuration: animationDuration,
      }}
    >
      {text}
    </div>
  );
};

const page = () => {
  return (
    /*
     * Fills the Demo frame rather than sitting inside it, the same way
     * `spring-image` does. `-m-6` cancels the frame's `p-6` exactly and
     * `rounded-lg` matches its radius, so the dashed edge lands on the frame's
     * own hairline. `place-self-stretch` is what lets it fill: the frame is a
     * grid with `place-items-center`, which sizes its child to content.
     *
     * `bg-bg` is load-bearing, not decoration. The frame's `ring-inset` is a
     * solid hairline, and a dashed border has gaps, so without a background
     * the ring shows through every gap and reads as a second border. A child
     * background clips to its border box by default, which means it paints
     * under the dashes and hides the ring.
     */
    <div className="-m-6 flex min-h-64 place-self-stretch items-center justify-center rounded-lg border-2 border-dashed border-stroke bg-bg p-10 font-mono">
      <PhraseTransition
        phrases={samplePhrases}
        interval={2000}
        className="text-center"
      />
    </div>
  );
};

export default page;
