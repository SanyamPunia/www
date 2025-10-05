"use client";

import { AnimatePresence, motion } from "framer-motion";
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
            className="bg-gray-400 text-sm text-white/40"
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
      className={`inline-block bg-clip-text text-[#b5b5b532] ${
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
    <div className="flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      <div className="z-10 w-lg items-center justify-center font-mono lg:flex border-dashed rounded-md border-2 border-zinc-800 p-10">
        <PhraseTransition
          phrases={samplePhrases}
          interval={2000}
          className="text-center"
        />
      </div>
    </div>
  );
};

export default page;
