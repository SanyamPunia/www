"use client";

import {
  motion,
  useAnimationControls,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { VerifiedIcon } from "lucide-react";
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
    <div className="flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      <section className="bg-neutral-900 border border-zinc-800 rounded-md p-4 relative max-w-md">
        <div className="flex items-center gap-2 mb-6">
          {(isDragging || isAnimatingBack) && (
            <motion.div
              {...({
                initial: { opacity: 0.5 },
                animate: { opacity: 1 },
                className:
                  "w-[32px] h-[32px] rounded-full border-2 border-dashed border-zinc-800 -ml-1 mr-1",
              } as Record<string, unknown>)}
            />
          )}
          <motion.div
            style={{
              x: springX,
              y: springY,
              position: isDragging || isAnimatingBack ? "absolute" : "relative",
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
              className="rounded-full select-none -ml-1 cursor-grab active:cursor-grabbing border-2 bg-black p-1.5"
              draggable="false"
            />
          </motion.div>

          <div>
            <h1 className="text-sm font-medium flex items-center gap-1">
              <span>Sanyam</span>
              <VerifiedIcon className="size-4 text-white [&>path:first-child]:fill-blue-500" />
            </h1>
            <p className="text-xs">Frontend Engineer</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm mx-auto leading-relaxed text-zinc-200">
            Design-driven developer focused on making React products{" "}
            <span className="text-zinc-400">
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
