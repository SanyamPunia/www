"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ibmPlexSerif } from "@/app/fonts";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import { labsRegistry } from "@/lib/labs.registry";
import { playTapSound } from "@/lib/utils";

const page = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden max-h-[90vh] flex flex-col"
        animated={true}
        // showTerminalHeader={true}
      >
        <div className="flex flex-col gap-6 sm:py-16 py-12 sm:px-8 px-0 overflow-y-auto flex-1">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-4"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
              onClick={playTapSound}
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
                transition: { staggerChildren: 0.08, delayChildren: 0.4 },
              },
            }}
          >
            <motion.h1
              className={`text-sm lowercase font-medium mb-2 text-text-primary ${ibmPlexSerif.className} italic`}
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
              lab
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
              experiments, prototypes, and side projects. this is where i test
              new ideas, build random tools, and break things for fun.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0, duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {labsRegistry.map((lab, index) => {
              const column = index % 3;
              const hoverTransform =
                column === 0
                  ? { scale: 1.01, x: -3 }
                  : column === 1
                    ? { scale: 1.01, y: -3 }
                    : { scale: 1.01, x: 3 };

              return (
                <motion.div
                  key={lab.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                  }}
                  whileHover={hoverTransform}
                >
                  <Link
                    href={`/lab/${lab.slug}`}
                    className="rounded-xl border border-[#1e1e1e] p-1 hover:border-[#282828] cursor-pointer transition-colors block"
                    onClick={playTapSound}
                  >
                    <div className="h-64 w-full overflow-hidden rounded-xl border-zinc-800 bg-neutral-900 sm:h-44 flex items-center justify-center relative">
                      <Image
                        src={lab.image}
                        alt={lab.title}
                        fill
                        className="w-full h-full object-cover select-none"
                        draggable="false"
                      />
                    </div>
                    <div className="py-1.5 px-1">
                      <h3 className="text-sm text-text-primary lowercase">
                        {lab.title}
                      </h3>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default page;
