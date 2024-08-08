import Image from "next/image";
import React from "react";

type Props = {};

const Projects = (props: Props) => {
  return (
    <div className="mt-16 sm:-mx-2 text-xs">
      <h1 className="text-xs text-muted-foreground mb-3">/projects</h1>

      <a href="https://skillup-ncu.vercel.app/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-[10px] mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              Sn
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Skill Up NCU</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Quick Q&A for university students.</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://6ed9fd44.gym-landing-page.pages.dev/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-[10px] mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              Eg
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">EvoGym</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Responsive GYM page using VITE, Framer, Cloudflare.</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://flib.store" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image src="/flib.png" width={36} height={36} alt="flib-logo" />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">flib.store</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Built Flib&apos;s app with Next.js, TypeScript, Jotai.</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Projects;
