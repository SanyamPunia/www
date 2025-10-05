"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Clock, Copy, Dot } from "lucide-react";
import { useState } from "react";

interface LabHeaderProps {
  title: string;
  createdAt?: string;
}

export default function LabHeader({ title, createdAt }: LabHeaderProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyPageLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4"
      >
        <a
          href="/lab"
          className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
        >
          <ArrowLeft className="size-3 transition-all group-hover:-translate-x-0.5" />
          back to lab
        </a>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.08, delayChildren: 0.35 },
          },
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <motion.h1
            className="text-sm lowercase font-medium text-text-primary"
            variants={{
              hidden: { opacity: 0, y: 4, filter: "blur(6px)" },
              show: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.4, ease: "easeOut" },
              },
            }}
          >
            {title}
          </motion.h1>

          <motion.div
            className="flex items-center gap-2"
            variants={{
              hidden: { opacity: 0, y: 4, filter: "blur(6px)" },
              show: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.4, ease: "easeOut" },
              },
            }}
          >
            <p className="text-xs text-text-secondary lowercase flex items-center">
              <Clock className="size-3 inline-block mr-1" />
              {createdAt}
            </p>
            <Dot className="size-3.5 text-text-secondary" />
            <button
              type="button"
              onClick={copyPageLink}
              className="text-text-secondary hover:text-text-primary transition-colors group cursor-pointer"
            >
              <div className="relative w-3 h-3 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {isCopied ? (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="absolute transition-all group-hover:scale-110"
                    >
                      <Check className="size-3" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="absolute transition-all group-hover:scale-110"
                    >
                      <Copy className="size-3" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </button>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
