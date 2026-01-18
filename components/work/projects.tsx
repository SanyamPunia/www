"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { ibmPlexSerif } from "@/app/fonts";
import { useMobile } from "@/hooks/use-mobile";
import { projects } from "@/lib/constant";
import { playTapSound } from "@/lib/utils";
import { ImageWithSkeleton } from "./image-with-skeleton";
import { ProjectModal } from "./modals/project-modal";

export default function Projects() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const isMobile = useMobile();

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
        className="flex flex-col gap-0 bg-neutral-900/30 ring ring-[#131313] rounded-sm mt-8 overflow-hidden"
      >
        {projects.map((p, idx) => {
          const isHovered = hoveredIndex === idx;
          const isDimmed = hoveredIndex !== null && hoveredIndex !== idx;

          return (
            <motion.div
              key={`${p.title}-${idx}`}
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
                idx < projects.length - 1
                  ? "border-b border-neutral-900 border-dashed"
                  : ""
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                if (!isMobile) {
                  setSelectedProject(idx);
                  playTapSound();
                }
              }}
            >
              {isMobile ? (
                <Link
                  href={p.href}
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
                        : idx === projects.length - 1 && isHovered
                          ? "rounded-b-sm"
                          : ""
                    }`}
                  >
                    <div className="relative z-10">
                      <ImageWithSkeleton
                        src={p.image}
                        alt={p.title}
                        width={28}
                        height={28}
                        className="rounded-full select-none border border-[#1e1e1e] bg-black"
                        draggable={false}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-text-primary block truncate">
                        {p.title}
                      </span>
                      <span className="text-xs text-text-secondary block truncate">
                        {p.description}
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary whitespace-nowrap">
                      {p.category}
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
                        : idx === projects.length - 1 && isHovered
                          ? "rounded-b-sm"
                          : ""
                    }`}
                  >
                    <motion.div
                      layoutId={`project-image-${idx}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      <ImageWithSkeleton
                        src={p.image}
                        alt={p.title}
                        width={28}
                        height={28}
                        className="rounded-full select-none border border-[#1e1e1e] bg-black"
                        draggable={false}
                      />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <motion.span
                        layoutId={`project-title-${idx}`}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="text-xs text-text-primary block truncate relative z-50"
                        style={{ zIndex: 50 }}
                      >
                        {p.title}
                      </motion.span>
                      <motion.span
                        layoutId={`project-description-${idx}`}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        className="text-xs text-text-secondary block truncate relative z-50"
                        style={{ zIndex: 50 }}
                      >
                        {p.description}
                      </motion.span>
                    </div>
                    <motion.span
                      layoutId={`project-category-${idx}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="text-xs text-text-secondary whitespace-nowrap relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      {p.category}
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
        {!isMobile && selectedProject !== null && (
          <ProjectModal
            project={projects[selectedProject]}
            index={selectedProject}
            onClose={() => setSelectedProject(null)}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
