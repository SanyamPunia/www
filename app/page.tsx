"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, File } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { GitHub } from "@/components/icons/github";
import { Gmail } from "@/components/icons/gmail";
import India from "@/components/icons/india";
import { LinkedIn } from "@/components/icons/linkedin";
import MediumIcon from "@/components/icons/medium";
import PageoIcon from "@/components/icons/pageo";
import { XformerlyTwitter } from "@/components/icons/x";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import Signature from "@/components/ui/signature";
import Tooltip from "@/components/ui/tooltip";

const page = () => {
  const [emailCopied, setEmailCopied] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const clearTooltipTimeout = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }
  };

  const handleEmailClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText("lewarends@gmail.com");
      setEmailCopied(true);
      clearTooltipTimeout();
      const timeout = setTimeout(() => setEmailCopied(false), 3000);
      setTooltipTimeout(timeout);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  const handleOpenProvider = () => {
    window.open("mailto:lewarends@gmail.com", "_blank");
    setEmailCopied(false);
    clearTooltipTimeout();
  };

  const handleTooltipMouseEnter = () => {
    clearTooltipTimeout();
  };

  const handleTooltipMouseLeave = () => {
    const timeout = setTimeout(() => setEmailCopied(false), 1000);
    setTooltipTimeout(timeout);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
        animated={true}
        showTerminalHeader={true}
      >
        <div className="flex flex-col gap-6 py-28 px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Image
              src="/assets/logo.png"
              alt="Sanyam"
              width={25}
              height={25}
              className="-rotate-45 select-none"
              draggable="false"
            />
          </motion.div>
          <div>
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
                className="text-sm lowercase font-medium mb-6 text-text-primary"
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
                Sanyam is a full-stack web developer from{" "}
                <India className="inline -mt-0.5" /> india
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
                As a developer, I believe simplicity is essential for a great
                user experience. Clean design and efficient code make a big
                difference. I'm currently leading frontend at{" "}
                <a
                  href="https://bitscale.ai"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                >
                  Bitscale
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . Previously, I also led engineering at{" "}
                <a
                  href="https://flib.store"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                >
                  Flib
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . You can find more of my work and project experience{" "}
                <Link
                  href="/work"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                >
                  here
                </Link>
                .
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
                I write technical blogs sharing insights from my projects. You
                can check them out{" "}
                <Link
                  href="/blogs"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                >
                  here
                </Link>
                . You can also visit my{" "}
                <Link
                  href="/lab"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                >
                  lab
                </Link>{" "}
                for some of my UI crafts and experiments.
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
                Lately I've been interested in dev tooling and npm package
                building. I recently published{" "}
                <a
                  href="https://www.npmjs.com/package/envt"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                >
                  envt
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                .
              </motion.p>

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
                i also make{" "}
                <a
                  href="https://soundcloud.com/prodmxle"
                  target="_blank"
                  className="underline underline-offset-4 transition-all group hover:text-text-primary"
                  rel="noopener"
                >
                  music
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . feel free to reach out if you want to talk about startups,
                have a cool idea, or anything in general.
              </motion.p>

              <motion.div
                className="mt-6 flex items-center -ml-1 gap-1"
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
                <a
                  href="https://www.pageo.me/sanyam"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PageoIcon className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>

                <a
                  href="https://github.com/SanyamPunia"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHub className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <a
                  href="https://www.linkedin.com/in/sanyampunia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-all rounded-lg hover:bg-neutral-800/50 p-2"
                >
                  <LinkedIn />
                </a>
                <a
                  href="https://x.com/sanyampunia"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <XformerlyTwitter className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <a
                  href="https://medium.com/@sanyamm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MediumIcon className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <Link href="/cv" target="_blank" rel="noopener noreferrer">
                  <File className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </Link>

                <Tooltip
                  show={emailCopied}
                  onOpenProvider={handleOpenProvider}
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                >
                  <a
                    href="mailto:lewarends@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleEmailClick}
                    className="relative"
                  >
                    <AnimatePresence mode="wait">
                      {emailCopied ? (
                        <motion.div
                          key="check"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Check className="transition-all rounded-lg bg-green-500/20 hover:bg-green-500/30 p-2 size-7 text-green-400" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="gmail"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Gmail className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </a>
                </Tooltip>
              </motion.div>
            </motion.div>
            <Signature className="mx-auto -mt-2 -mb-16 -ml-5" />
          </div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default page;
