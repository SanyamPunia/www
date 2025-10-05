"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { highlight } from "sugar-high";

interface CodeBlockProps {
  children: string;
  className?: string;
}

export default function CodeBlock({
  children,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const codeHTML = highlight(children);

  return (
    <div className={`relative group ${className}`}>
      <button
        type="button"
        onClick={copyToClipboard}
        className="absolute cursor-pointer top-3 right-3 z-10 p-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        title="Copy code"
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Check className="size-3 text-green-400" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Copy className="size-3 text-neutral-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      <pre className="relative overflow-x-auto pr-10">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting outputs trusted HTML */}
        <code dangerouslySetInnerHTML={{ __html: codeHTML }} />
      </pre>
    </div>
  );
}
