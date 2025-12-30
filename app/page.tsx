"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BotMessageSquare, Check, File } from "lucide-react";
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
import { LastVisit } from "@/components/ui/last-visit";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import NowPlaying from "@/components/ui/now-playing";
import { NpmStats } from "@/components/ui/npm-stats";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Signature from "@/components/ui/signature";
import Tooltip from "@/components/ui/tooltip";
import { usePageviews } from "@/hooks/use-pageviews";
import { ordinal, playTapSound } from "@/lib/utils";

const page = () => {
  const [emailCopied, setEmailCopied] = useState(false);
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const { count, isLoading: isLoadingPageviews } = usePageviews(
    "sanyam.xyz",
    "all",
  );
  const visitorLabel = count !== null ? ordinal(count) : null;

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="fixed -left-96 -bottom-96 size-192 rounded-full pointer-events-none -z-10"
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
        // showTerminalHeader={true}
      >
        <div className="flex flex-col gap-6 sm:py-28 py-12 px-0 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Image
              src="/assets/logo.webp"
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
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline -mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                      aria-label="India flag"
                    >
                      <India className="inline" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 border-[#1e1e1e]">
                    <div className="relative">
                      <Image
                        src="/assets/location.webp"
                        alt="Location"
                        width={200}
                        height={200}
                        priority
                        className="rounded-md select-none"
                        draggable="false"
                      />
                    </div>
                    <p className="text-xs text-right mt-2 text-text-secondary">
                      Bangalore, India
                    </p>
                  </PopoverContent>
                </Popover>{" "}
                india
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
                difference. I'm currently working as a frontend engineer at{" "}
                <a
                  href="https://www.enclave.money/"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                  onClick={playTapSound}
                >
                  Enclave
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . Previously, I also led engineering at{" "}
                <a
                  href="https://bitscale.ai/"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                  onClick={playTapSound}
                >
                  Bitscale
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . You can find more of my work and project experience{" "}
                <Link
                  href="/work"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                  onClick={playTapSound}
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
                I write technical{" "}
                <Link
                  href="/blogs"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                  onClick={playTapSound}
                >
                  blogs
                </Link>{" "}
                sharing insights from my projects. You can also visit my{" "}
                <Link
                  href="/lab"
                  className="underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300"
                  onClick={playTapSound}
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
                Lately I've been into dev tooling. I recently published{" "}
                <a
                  href="https://www.npmjs.com/package/unique-forge"
                  target="_blank"
                  className="underline underline-offset-4 transition-all hover:text-text-primary group"
                  rel="noopener"
                  onClick={playTapSound}
                >
                  unique-forge
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>{" "}
                <NpmStats packageName="unique-forge" />.
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
                i make{" "}
                <a
                  href="https://soundcloud.com/prodmxle"
                  target="_blank"
                  className="underline underline-offset-4 transition-all group hover:text-text-primary"
                  rel="noopener"
                  onClick={playTapSound}
                >
                  music
                  <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                . feel free to reach out if you want to talk about startups,
                have a cool idea, or anything in general.
                {isLoadingPageviews || visitorLabel ? (
                  <>
                    {" "}
                    also, congrats! you are the{" "}
                    {isLoadingPageviews ? (
                      <span className="inline-block h-4 w-8 rounded bg-neutral-800 animate-pulse" />
                    ) : (
                      <span className="text-text-primary text-sm">
                        {visitorLabel}
                      </span>
                    )}{" "}
                    visitor.
                  </>
                ) : null}
              </motion.p>

              <NowPlaying />

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
                  onClick={playTapSound}
                >
                  <PageoIcon className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>

                <a
                  href="https://github.com/SanyamPunia"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playTapSound}
                >
                  <GitHub className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <a
                  href="https://www.linkedin.com/in/sanyampunia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-all rounded-lg hover:bg-neutral-800/50 p-2"
                  onClick={playTapSound}
                >
                  <LinkedIn />
                </a>
                <a
                  href="https://x.com/sanyampunia"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playTapSound}
                >
                  <XformerlyTwitter className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <a
                  href="https://medium.com/@sanyamm"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playTapSound}
                >
                  <MediumIcon className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </a>
                <Link
                  href="/cv"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playTapSound}
                >
                  <File className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
                </Link>
                <Link
                  href="/llms.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playTapSound}
                >
                  <BotMessageSquare className="transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7" />
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
                    onClick={(e) => {
                      handleEmailClick(e);
                      playTapSound();
                    }}
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
      <LastVisit />
    </div>
  );
};

export default page;
