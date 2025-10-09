"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import { labsRegistry } from "@/lib/labs.registry";

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
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
            >
              <ArrowLeft className="size-3 transition-all group-hover:-translate-x-0.5" />
              back to home
            </a>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {labsRegistry.map((lab, index) => (
              <motion.a
                key={lab.slug}
                href={`/lab/${lab.slug}`}
                className="rounded-xl border border-[#1e1e1e] p-1 hover:border-[#282828] cursor-pointer transition-colors"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.6 + index * 0.1,
                  duration: 0.4,
                  ease: "easeOut",
                }}
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
              </motion.a>
            ))}
          </motion.div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default page;
