"use client";

import MediumIcon from "@/components/icons/medium";
import { Music } from "@/components/music";
import { Projects } from "@/components/projects";
import { Work } from "@/components/work";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LuFile, LuGithub, LuLinkedin, LuMail } from "react-icons/lu";
import XLogoIcon from "../components/icons/x";
import MaxWidthWrapper from "../components/max-width-wrapper";
import PageoIcon from "@/components/icons/pageo";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const containerVariants = {
    hidden: {
      opacity: 0,
      filter: "blur(8px)",
      y: 5,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 15,
      filter: "blur(5px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <MaxWidthWrapper>
      <motion.div
        className="my-32 sm:my-52"
        initial="hidden"
        animate={isLoaded ? "visible" : "hidden"}
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <Image
            src="/logo.png"
            height={30}
            width={30}
            alt="logo"
            draggable="false"
            className="select-none -rotate-45"
          />
        </motion.div>

        <motion.div className="mt-6 space-y-4" variants={itemVariants}>
          <motion.h1
            className="font-medium text-sm lowercase"
            variants={itemVariants}
          >
            Sanyam is a full-stack web developer from india
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-sm lowercase"
            variants={itemVariants}
          >
            As a developer, I believe simplicity is essential for a great user
            experience. Clean design and efficient code make a big difference.
          </motion.p>

          <motion.p
            className="text-muted-foreground text-sm lowercase"
            variants={itemVariants}
          >
            This year, I joined{" "}
            <a
              href="https://bitscale.ai"
              target="_blank"
              className="border border-gray-400/15 rounded-md bg-border py-[1px] px-1 inline-block space-x-1 transition-all hover:text-primary"
              rel="noreferrer"
            >
              <code>Bitscale</code>
              <Image
                src="/org/bitscale.png"
                className="rounded-full inline-block select-none mb-0.5"
                height={17}
                width={17}
                alt="bitscale-logo"
                draggable="false"
              />
            </a>{" "}
            where I&apos;m developing and leading the frontend. I&apos;m also
            leading development at my startup,{" "}
            <a
              href="https://flib.store"
              target="_blank"
              className="border border-gray-400/15 rounded-md bg-border py-[1px] px-1 inline-block space-x-1 transition-all hover:text-primary"
              rel="noreferrer"
            >
              <code>Flib</code>
              <Image
                src="/org/flib.png"
                className="rounded-md inline-block select-none mb-0.5"
                height={17}
                width={17}
                alt="flib-logo"
                draggable="false"
              />
            </a>
            .
          </motion.p>

          <motion.p
            className="text-muted-foreground text-sm lowercase"
            variants={itemVariants}
          >
            I also write technical blogs sharing insights from my projects.
            Check them out{" "}
            <Link
              href="/blogs"
              className="underline underline-offset-2 text-white"
            >
              here
            </Link>
            .
          </motion.p>

          <motion.div
            className="bg-border/20 relative rounded-md py-4 px-4 flex items-center text-neutral-400 mt-8 mb-4"
            variants={itemVariants}
          >
            <div className="rounded-full bg-green-400 h-[8px] w-[8px] inline-block mr-2"></div>
            <div className="absolute animate-ping rounded-full bg-green-400 h-[8px] w-[8px] mr-2"></div>

            <p className="text-muted-foreground text-xs lowercase">
              Actively seeking full-time front-end dev roles.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-6 flex items-center -ml-2 gap-0.5"
          variants={itemVariants}
        >
          <a
            href="https://pageo.me/sanyam"
            target="_blank"
            rel="noopener noreferrer"
          >
            <PageoIcon
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>

          <a
            href="https://github.com/SanyamPunia"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuGithub
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="https://www.linkedin.com/in/sanyampunia/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuLinkedin
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="https://www.x.com/sanyampunia"
            target="_blank"
            rel="noopener noreferrer"
          >
            <XLogoIcon
              className="transition-all rounded-lg hover:bg-secondary p-2 fill-white"
              size={31}
            />
          </a>
          <a
            href="https://medium.com/@sanyamm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MediumIcon
              className="transition-all rounded-lg hover:bg-secondary p-2 fill-white"
              size={33}
            />
          </a>
          <a
            href="mailto:lewarends@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuMail
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>

          <a
            href="/files/sanyam_cv.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuFile
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
        </motion.div>

        <Work />
        <Projects />
        <Music />
      </motion.div>
    </MaxWidthWrapper>
  );
}
