import Image from "next/image";
import React from "react";

type Props = {};

const Projects = (props: Props) => {
  return (
    <div className="mt-16 sm:-mx-2 text-xs">
      <h1 className="text-xs text-muted-foreground mb-3">/projects</h1>

      <a href="https://github.com/SanyamPunia/profanity-api" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/profanity.jpg"
                width={36}
                height={36}
                alt="profanity-logo"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Profanity API</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Profanity check at scale using hono, upstash & cloudflare</p>
              <span className="px-2 py-px rounded-lg bg-secondary">api</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://www.npmjs.com/package/next-comp-cli" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/gnc.png"
                width={36}
                height={36}
                alt="next-comp-cli"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">next-comp-cli</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>generate next.js components (typescript) using cli</p>
              <span className="px-2 py-px rounded-lg bg-secondary">
                package
              </span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://www.npmjs.com/package/unique-forge" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/uf.png"
                width={36}
                height={36}
                alt="unique-forge"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">unique-forge</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>type-safe nanoid alternative to generate secure IDs</p>
              <span className="px-2 py-px rounded-lg bg-secondary">
                package
              </span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://on-snip.org" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/onsnip.png"
                width={36}
                height={36}
                alt="on-snip-logo"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">on-snip.org</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Real-time Collaborative Messaging Rooms</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://flib.store" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/flib.png"
                width={36}
                height={36}
                alt="flib-logo"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">flib.store</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Built Flib&apos;s app with Next.js, TypeScript, Zustand.</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://better-gist.vercel.app/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/bg.png"
                width={36}
                height={36}
                alt="better-gist-logo"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">better-gist</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>generate `shareable` code snippets.</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://stick-it-olive.vercel.app/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/stickit.png"
                width={36}
                height={36}
                alt="stickit-logo"
                draggable="false"
                className="select-none"
              />
            </div>
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">stick_it</h1>
            <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
              <p>Seamlessly generate priority to-do wallpapers on the go</p>
              <span className="px-2 py-px rounded-lg bg-secondary">web</span>
            </div>
          </div>
        </div>
      </a>

      <a href="https://skillup-ncu.vercel.app" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
            <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
              <Image
                src="/projects/skillup.png"
                width={36}
                height={36}
                alt="skillup-logo"
                draggable="false"
                className="select-none"
              />
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
    </div>
  );
};

export default Projects;
