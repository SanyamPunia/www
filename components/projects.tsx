"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useAnimationInView } from "@/hooks/use-animation";

type Project = {
  name: string;
  logo: string;
  description: string;
  category: string;
  url: string;
};

const projects: Project[] = [
  {
    name: "Profanity API",
    logo: "/projects/profanity.jpg",
    description: "Profanity check at scale using hono, upstash & cloudflare",
    category: "api",
    url: "https://github.com/SanyamPunia/profanity-api",
  },
  {
    name: "next-comp-cli",
    logo: "/projects/gnc.png",
    description: "generate next.js components (typescript) using cli",
    category: "package",
    url: "https://www.npmjs.com/package/next-comp-cli",
  },
  {
    name: "unique-forge",
    logo: "/projects/uf.png",
    description: "type-safe nanoid alternative to generate secure IDs",
    category: "package",
    url: "https://www.npmjs.com/package/unique-forge",
  },
  {
    name: "on-snip.org",
    logo: "/projects/onsnip.png",
    description: "Real-time Collaborative Messaging Rooms",
    category: "web",
    url: "https://on-snip.org",
  },
  {
    name: "flib.store",
    logo: "/projects/flib.png",
    description: "Built Flib's app with Next.js, TypeScript, Zustand.",
    category: "web",
    url: "https://flib.store",
  },
  {
    name: "better-gist",
    logo: "/projects/bg.png",
    description: "generate `shareable` code snippets.",
    category: "web",
    url: "https://better-gist.vercel.app/",
  },
  {
    name: "stick_it",
    logo: "/projects/stickit.png",
    description: "Seamlessly generate priority to-do wallpapers on the go",
    category: "web",
    url: "https://stick-it-olive.vercel.app/",
  },
  {
    name: "Skill Up NCU",
    logo: "/projects/skillup.png",
    description: "Quick Q&A for university students.",
    category: "web",
    url: "https://skillup-ncu.vercel.app",
  },
];

export const Projects = () => {
  const { ref, isInView, containerVariants, itemVariants } =
    useAnimationInView(0.1);

  return (
    <motion.div
      className="mt-16 sm:-mx-2 text-xs"
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
    >
      <motion.h1
        className="text-xs text-muted-foreground mb-3"
        variants={itemVariants}
      >
        /projects
      </motion.h1>

      {projects.map((project, index) => (
        <motion.a
          key={index}
          href={project.url}
          target="_blank"
          variants={itemVariants}
          rel="noreferrer"
        >
          <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
            <div className="bg-neutral-100 dark:bg-neutral-800 w-[36px] h-[36px] rounded-full mt-[2px] flex-shrink-0 shadow-shorter overflow-hidden">
              <div className="text-sm text-neutral-400 font-semibold flex justify-center items-center h-full">
                <Image
                  src={project.logo || "/placeholder.svg"}
                  width={36}
                  height={36}
                  alt={`${project.name.toLowerCase()}-logo`}
                  draggable="false"
                  className="select-none"
                />
              </div>
            </div>
            <div className="w-full pb-4 border-b border-secondary/40">
              <h1 className="font-medium">{project.name}</h1>
              <div className="mt-px lowercase text-muted-foreground flex justify-between gap-2 items-center">
                <p>{project.description}</p>
                <span className="px-2 py-px rounded-lg bg-secondary">
                  {project.category}
                </span>
              </div>
            </div>
          </div>
        </motion.a>
      ))}
    </motion.div>
  );
};