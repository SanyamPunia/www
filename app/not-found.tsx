"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="fixed -left-96 -bottom-96 w-[48rem] h-[48rem] rounded-full pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, rgba(20, 184, 166, 0.08) 35%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
        animated={true}
      >
        <div className="flex flex-col gap-6 py-32 sm:px-8 px-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-4"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
            >
              <ArrowLeft className="size-3 transition-all group-hover:-translate-x-0.5" />
              back to home
            </Link>
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
              404 - page not found
            </motion.h1>
            <motion.p
              className="text-sm text-text-secondary lowercase leading-5 mb-6"
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
              the page you're looking for doesn't exist or has been moved.
            </motion.p>
            <motion.p
              className="text-sm text-text-secondary lowercase leading-5 mb-6"
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
              you can check out my{" "}
              <Link
                href="/work"
                className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
              >
                work
              </Link>
              ,{" "}
              <Link
                href="/blogs"
                className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
              >
                blogs
              </Link>
              , or{" "}
              <Link
                href="/lab"
                className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
              >
                lab
              </Link>{" "}
              instead.
            </motion.p>
          </motion.div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
}
