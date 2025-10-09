"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";

export default function LabNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
        animated={true}
        // showTerminalHeader={true}
      >
        <div className="flex flex-col gap-6 py-32 sm:px-8 px-0">
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
            <motion.h1
              className="text-sm lowercase font-medium mb-2 text-text-primary"
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
              not found
            </motion.h1>
            <motion.p
              className="text-sm text-text-secondary lowercase leading-5"
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
              this lab experiment doesn't exist yet. check back later.
            </motion.p>
          </motion.div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
}
