"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ibmPlexSerif } from "@/app/fonts";
import { useMobile } from "@/hooks/use-mobile";
import { companies } from "@/lib/constant";
import { playTapSound } from "@/lib/utils";
import { CompanyModal } from "./modals/company-modal";

export default function Companies() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const isMobile = useMobile();

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
        className="flex flex-col gap-0 bg-neutral-900/30 ring ring-[#131313] rounded-sm mt-3 overflow-hidden"
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
              onClick={() => {
                if (!isMobile) {
                  setSelectedCompany(idx);
                  playTapSound();
                }
              }}
            >
              {isMobile ? (
                <Link
                  href={c.href}
                  target="_blank"
                  className="transition-opacity duration-200 cursor-pointer block"
                  style={{ opacity: isDimmed ? 0.3 : 1 }}
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
                    <div className="relative z-10">
                      <Image
                        src={c.logo}
                        alt={c.name}
                        width={28}
                        height={28}
                        className="rounded-full select-none border border-[#1e1e1e] bg-black"
                        draggable={false}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-text-primary block truncate">
                        {c.name}
                      </span>
                      <span className="text-xs text-text-secondary block truncate">
                        {c.title}
                      </span>
                    </div>
                    <span className="text-[0.70em] px-2 py-0.5 rounded-sm text-text-secondary whitespace-nowrap">
                      {c.duration}
                    </span>
                  </div>
                </Link>
              ) : (
                <div
                  className="transition-opacity duration-200 cursor-pointer"
                  style={{ opacity: isDimmed ? 0.3 : 1 }}
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
                    <motion.div
                      layoutId={`company-logo-${idx}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      <Image
                        src={c.logo}
                        alt={c.name}
                        width={28}
                        height={28}
                        className="rounded-full select-none border border-[#1e1e1e] bg-black"
                        draggable={false}
                      />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <motion.span
                        layoutId={`company-name-${idx}`}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="text-xs text-text-primary block truncate relative z-50"
                        style={{ zIndex: 50 }}
                      >
                        {c.name}
                      </motion.span>
                      <motion.span
                        layoutId={`company-title-${idx}`}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="text-xs text-text-secondary block truncate relative z-50"
                        style={{ zIndex: 50 }}
                      >
                        {c.title}
                      </motion.span>
                    </div>
                    <motion.span
                      layoutId={`company-duration-${idx}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="text-[0.70em] px-2 py-0.5 rounded-sm text-text-secondary whitespace-nowrap relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      {c.duration}
                    </motion.span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Modal - Desktop Only */}
      <AnimatePresence>
        {!isMobile && selectedCompany !== null && (
          <CompanyModal
            company={companies[selectedCompany]}
            index={selectedCompany}
            onClose={() => setSelectedCompany(null)}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
