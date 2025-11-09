"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ibmPlexSerif } from "@/app/fonts";
import { playTapSound } from "@/lib/utils";

const companies = [
  {
    name: "Bitscale",
    logo: "/org/bitscale.webp",
    title: "Founding Engineer",
    duration: "feb'25 - Now",
    href: "https://bitscale.ai/",
  },
  {
    name: "Flib",
    logo: "/org/flib.webp",
    title: "Founder/CEO",
    duration: "2023 - Now",
    href: "https://flib.store",
  },
  {
    name: "Xurrent (Zenduty)",
    logo: "/org/xurrent.webp",
    title: "Frontend Engineer Intern",
    duration: "summer'23 + summer'24",
    href: "https://www.zenduty.com/",
  },
  {
    name: "Buildfast",
    logo: "/org/buildfast.webp",
    title: "Frontend Developer Intern",
    duration: "Feb'23 - Mar'23",
    href: "https://www.buildfast.co.in/",
  },
  {
    name: "Google Code-In",
    logo: "/org/google.webp",
    title: "Finalist | Score Lab",
    duration: "Oct'18 - Dec'18",
    href: "https://codein.withgoogle.com/archive/2018/",
  },
];

export default function Companies() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.08, delayChildren: 0.4 },
        },
      }}
      className="mb-8"
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
        work
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
        i&apos;ve been fortunate to work with some great companies and peers,
        creating some very cool projects that have achieved some solid numbers
        as well.
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
        className="flex flex-col gap-0 bg-neutral-900/30 ring ring-[#131313] rounded-sm mt-3"
      >
        {companies.map((c, idx) => {
          const isHovered = hoveredIndex === idx;
          const isDimmed = hoveredIndex !== null && hoveredIndex !== idx;

          return (
            <motion.div
              key={`${c.name}-${idx}`}
              initial="hidden"
              animate={{
                ...(isHovered ? { scale: 1.01 } : { scale: 1 }),
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              variants={{
                hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.35, ease: "easeOut" },
                },
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`lowercase ${
                idx < companies.length - 1
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
                  href={c.href}
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
                        : idx === companies.length - 1 && isHovered
                          ? "rounded-b-sm"
                          : ""
                    }`}
                  >
                    <Image
                      src={c.logo}
                      alt={c.name}
                      width={28}
                      height={28}
                      className="rounded-full select-none border border-[#1e1e1e] bg-black"
                      draggable={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate flex items-center gap-1">
                        {c.name}
                        <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {c.title}
                      </p>
                    </div>
                    <span className="text-[0.70em] px-2 py-0.5 rounded-sm text-text-secondary whitespace-nowrap">
                      {c.duration}
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
