"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { Project } from "@/lib/constant";
import { playTapSound } from "@/lib/utils";
import { ImageWithSkeleton } from "../image-with-skeleton";
import { renderTextWithCode } from "../render-text-with-code";

interface ProjectModalProps {
  project: Project;
  index: number;
  onClose: () => void;
  isMobile: boolean;
}

export function ProjectModal({
  project,
  index,
  onClose,
  isMobile,
}: ProjectModalProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    setCurrentSlide(carouselApi.selectedScrollSnap());

    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, width: "60%" }}
          animate={{ scale: 1, opacity: 1, width: "100%" }}
          exit={{ scale: 0.9, opacity: 0, width: "60%" }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
            width: { duration: 0.3, ease: "easeOut" },
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0b0b0b] border border-[#1e1e1e] rounded-sm max-w-md max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="lowercase">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-900 border-dashed">
              {isMobile ? (
                <div className="relative z-10">
                  <ImageWithSkeleton
                    src={project.image}
                    alt={project.title}
                    width={28}
                    height={28}
                    className="rounded-full select-none border border-[#1e1e1e] bg-black"
                    draggable={false}
                  />
                </div>
              ) : (
                <motion.div
                  layoutId={`project-image-${index}`}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  className="relative z-50"
                  style={{ zIndex: 50 }}
                >
                  <ImageWithSkeleton
                    src={project.image}
                    alt={project.title}
                    width={28}
                    height={28}
                    className="rounded-full select-none border border-[#1e1e1e] bg-black"
                    draggable={false}
                  />
                </motion.div>
              )}
              <div className="flex-1 min-w-0">
                {isMobile ? (
                  <>
                    <span className="text-xs text-text-primary block truncate">
                      {project.title}
                    </span>
                    <span className="text-xs text-text-secondary block truncate">
                      {project.description}
                    </span>
                  </>
                ) : (
                  <>
                    <motion.span
                      layoutId={`project-title-${index}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="text-xs text-text-primary block truncate relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      {project.title}
                    </motion.span>
                    <motion.span
                      layoutId={`project-description-${index}`}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="text-xs text-text-secondary block truncate relative z-50"
                      style={{ zIndex: 50 }}
                    >
                      {project.description}
                    </motion.span>
                  </>
                )}
              </div>
              {isMobile ? (
                <span className="text-xs text-text-secondary whitespace-nowrap">
                  {project.category}
                </span>
              ) : (
                <motion.span
                  layoutId={`project-category-${index}`}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  className="text-xs text-text-secondary whitespace-nowrap relative z-50"
                  style={{ zIndex: 50 }}
                >
                  {project.category}
                </motion.span>
              )}
            </div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(8px)", y: 8 }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                delay: 0.08,
              }}
              className="px-4 py-4"
            >
              <p className="text-xs text-text-secondary leading-5">
                {renderTextWithCode(project.details)}
              </p>
              {/* Collaborators */}
              {project.collaborators && project.collaborators.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-neutral-900/50">
                  <span className="text-xs text-text-muted">w/</span>
                  {project.collaborators.map((collaborator, idx) => (
                    <span
                      key={`collaborator-${collaborator.href}-${idx}`}
                      className="flex items-center gap-1.5"
                    >
                      <Link
                        href={collaborator.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
                        onClick={playTapSound}
                      >
                        {collaborator.name}
                        <ArrowUpRight className="size-3 inline-block transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </Link>
                      {idx < (project.collaborators?.length ?? 0) - 1 && (
                        <span className="text-sm text-text-muted select-none">
                          ·
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Preview Carousel */}
            {project.preview && project.preview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                exit={{ opacity: 0, filter: "blur(8px)", y: 8 }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut",
                  delay: 0.12,
                }}
                className="px-4 pb-4"
              >
                <Carousel
                  setApi={setCarouselApi}
                  opts={{ loop: true, duration: 15 }}
                  className="w-full"
                >
                  <CarouselContent className="ml-0">
                    {project.preview.map((img, idx) => (
                      <CarouselItem key={img} className="pl-0 basis-full">
                        <div className="relative aspect-video overflow-hidden rounded border border-[#1e1e1e]">
                          <Image
                            src={img}
                            alt={`${project.title} preview ${idx + 1}`}
                            fill
                            className="object-cover select-none"
                            draggable={false}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                {/* Carousel Controls */}
                {project.preview.length > 1 && (
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      {project.preview.map((img, idx) => (
                        <button
                          key={img}
                          type="button"
                          onClick={() => carouselApi?.scrollTo(idx)}
                          className={`size-1.5 rounded-full transition-colors cursor-pointer ${
                            currentSlide === idx
                              ? "bg-text-primary"
                              : "bg-[#3a3a3a] hover:bg-[#5a5a5a]"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => carouselApi?.scrollPrev()}
                        className="size-6 flex items-center justify-center rounded-sm border border-[#1e1e1e] bg-[#0b0b0b] text-text-secondary hover:text-text-primary hover:bg-[#141414] transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => carouselApi?.scrollNext()}
                        className="size-6 flex items-center justify-center rounded-sm border border-[#1e1e1e] bg-[#0b0b0b] text-text-secondary hover:text-text-primary hover:bg-[#141414] transition-colors cursor-pointer"
                      >
                        <ChevronRight className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="flex items-center justify-between px-4 py-3 border-t border-neutral-900 border-dashed bg-neutral-900/30"
            >
              <button
                onClick={onClose}
                type="button"
                className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                close
              </button>
              <Link
                href={project.href}
                target="_blank"
                className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 group cursor-pointer"
                onClick={playTapSound}
              >
                visit{" "}
                <ArrowUpRight className="size-3 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
