"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { playTapSound } from "@/lib/utils";

const projects = [
  {
    title: "Profanity API",
    image: "/projects/profanity.jpg",
    description: "profanity check at scale using hono, upstash & cloudflare",
    category: "api",
    href: "https://github.com/SanyamPunia/profanity-api",
  },
  {
    title: "unique-forge",
    image: "/projects/uf.png",
    description: "type-safe nanoid alternative to generate secure IDs",
    category: "package",
    href: "https://www.npmjs.com/package/unique-forge",
  },
  {
    title: "envt",
    image: "/projects/envt.png",
    description:
      "type-safe client-side environment variables with runtime validation",
    category: "package",
    href: "https://www.npmjs.com/package/envt",
  },
  {
    title: "pageo.me",
    image: "/projects/pageo.png",
    description: "simplest way to share all your links",
    category: "web",
    href: "https://pageo.me",
  },
  {
    title: "clyp",
    image: "/projects/clyp.png",
    description: "create better screenshots",
    category: "web",
    href: "https://clyp-omega.vercel.app/",
  },
  {
    title: "on-snip.org",
    image: "/projects/onsnip.png",
    description: "real-time collaborative messaging rooms",
    category: "web",
    href: "https://on-snip.org",
  },
  {
    title: "flib.store",
    image: "/projects/flib.png",
    description: "built flib's app with next.js, typescript, zustand",
    category: "web",
    href: "https://flib.store",
  },
  {
    title: "better-gist",
    image: "/projects/bg.png",
    description: "generate `shareable` code snippets",
    category: "web",
    href: "https://better-gist.vercel.app/",
  },
  {
    title: "stick_it",
    image: "/projects/stickit.png",
    description: "seamlessly generate priority to-do wallpapers on the go",
    category: "web",
    href: "https://stick-it-olive.vercel.app/",
  },
];

export default function Projects() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.08, delayChildren: 0.8 },
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
        projects
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
        selected projects and experiments in which i've put in some serious
        hours
      </motion.p>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
          show: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
              duration: 0.35,
              ease: "easeOut",
              staggerChildren: 0.08,
              delayChildren: 0.15,
            },
          },
        }}
        className="flex flex-col gap-0 bg-neutral-900/30 ring ring-[#131313] rounded-sm mt-8"
      >
        {projects.map((p, idx) => {
          const isHovered = hoveredIndex === idx;
          const isDimmed = hoveredIndex !== null && hoveredIndex !== idx;

          return (
            <motion.div
              key={`${p.title}-${idx}`}
              variants={{
                hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.35, ease: "easeOut" },
                },
              }}
              className={`lowercase ${
                idx < projects.length - 1
                  ? "border-b border-neutral-900 border-dashed"
                  : ""
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="transition-opacity duration-200"
                style={{ opacity: isDimmed ? 0.3 : 1 }}
              >
                <Link
                  href={p.href}
                  target="_blank"
                  className="group block"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={playTapSound}
                >
                  <div
                    className={`px-4 py-3.5 transition-colors duration-200 ${
                      isHovered ? "bg-neutral-900/50" : ""
                    } flex items-center gap-3 ${
                      idx === 0 && isHovered
                        ? "rounded-t-sm"
                        : idx === projects.length - 1 && isHovered
                          ? "rounded-b-sm"
                          : ""
                    }`}
                  >
                    <Image
                      src={p.image}
                      alt={p.title}
                      width={28}
                      height={28}
                      className="rounded-full select-none border border-[#1e1e1e] bg-black"
                      draggable={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate flex items-center gap-1">
                        {p.title}
                        <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {p.description}
                      </p>
                    </div>
                    <span className="text-xs text-text-secondary whitespace-nowrap">
                      {p.category}
                    </span>
                  </div>
                </Link>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
