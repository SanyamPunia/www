"use client";

import { SealCheckIcon } from "@phosphor-icons/react";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useSpring,
} from "motion/react";
import Image from "next/image";
import { useState } from "react";

const SpringImage = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingBack, setIsAnimatingBack] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 300 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);
  const profileControls = useAnimationControls();

  return (
    /*
     * The one dark surface on the site. `/assets/logo.webp` is white on
     * transparent, so on `bg` it rendered as an empty ring with nothing inside
     * it. Tinting the mark is not an option, it is the site's own logo, so the
     * ground inverts instead.
     *
     * `-m-6` cancels the Demo frame's `p-6` exactly and `rounded-lg` matches
     * its radius, so this fills the frame edge to edge and reads as one
     * surface rather than a black card floating in a white box.
     * `place-self-stretch` is what lets it fill: the frame is a grid with
     * `place-items-center`, which sizes its child to content.
     */
    <div className="-m-6 flex min-h-64 place-self-stretch items-center justify-center rounded-lg bg-inverse-bg p-6">
      <section className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          {/*
           * A fixed slot, so nothing reflows on drag. The draggable is always
           * absolute inside it and the placeholder shares its box, which means
           * the row cannot resize when one swaps for the other. Previously the
           * image sat in flow at 36px and the placeholder replaced it at 32px,
           * so the name jumped 0.8px left the instant you grabbed it.
           */}
          <div className="relative -ml-1 size-11.25 shrink-0">
            {(isDragging || isAnimatingBack) && (
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-inverse-stroke"
              />
            )}
            <motion.div
              className="absolute inset-0"
              style={{
                x: springX,
                y: springY,
                zIndex: isDragging ? 50 : 1,
              }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => {
                setIsDragging(false);
                setIsAnimatingBack(true);

                x.set(0);
                y.set(0);

                setTimeout(() => {
                  setIsAnimatingBack(false);
                }, 1000);
              }}
              whileDrag={{
                scale: 1.1,
              }}
              animate={profileControls}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
            >
              <Image
                src="/assets/logo.webp"
                alt="logo"
                width={36}
                height={36}
                className="size-full cursor-grab select-none rounded-full border-2 border-inverse-stroke bg-inverse-fill p-1.5 active:cursor-grabbing"
                draggable="false"
              />
            </motion.div>
          </div>

          <div>
            {/* not an <h1>: the lab page already renders one, and this is a
                card inside it rather than the page's heading */}
            <p className="flex items-center gap-1 text-body font-medium text-inverse-text">
              <span>Sanyam</span>
              <SealCheckIcon className="size-4 text-inverse-bg [&>path:first-child]:fill-blue-500" />
            </p>
            <p className="text-meta text-inverse-text-secondary">
              Frontend Engineer
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="mx-auto text-body leading-relaxed text-inverse-text">
            Design-driven developer focused on making React products{" "}
            <span className="text-inverse-text-secondary">
              and empowering users through web applications.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
};

const page = () => {
  return <SpringImage />;
};

export default page;
