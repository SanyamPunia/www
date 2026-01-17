"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import CodeParser from "@/components/ui/code-parser";
import { playTapSound } from "@/lib/utils";

interface LabContentProps {
  description?: string[];
  source?: string;
  reference?: string;
}

export default function LabContent({
  description,
  source,
  reference,
}: LabContentProps) {
  return (
    <>
      {description && (
        <motion.div
          className="space-y-3"
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
          {description.map((paragraph, index) => (
            <motion.p
              key={paragraph}
              className="text-sm text-text-secondary lowercase leading-5"
              variants={{
                hidden: { opacity: 0, y: 4, filter: "blur(6px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: {
                    duration: 0.4,
                    ease: "easeOut",
                    delay: index * 0.1,
                  },
                },
              }}
            >
              <CodeParser text={paragraph} />
            </motion.p>
          ))}
        </motion.div>
      )}

      {(source || reference) && (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 4, filter: "blur(6px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.4, ease: "easeOut" },
            },
          }}
          className="lowercase mt-3 flex items-center gap-3"
        >
          {source && (
            <a
              href={source}
              target="_blank"
              className="text-sm text-text-secondary lowercase leading-5 hover:text-text-primary transition-colors group"
              onClick={playTapSound}
            >
              source{" "}
              <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          )}
          {reference && (
            <a
              href={reference}
              target="_blank"
              className="text-sm text-text-secondary lowercase leading-5 hover:text-text-primary transition-colors group"
              onClick={playTapSound}
            >
              reference{" "}
              <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          )}
        </motion.div>
      )}
    </>
  );
}
