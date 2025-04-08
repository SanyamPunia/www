"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

type WorkExperience = {
  company: string;
  logo: string;
  role: string;
  period: string;
  url: string;
  logoRounded?: boolean;
};

const workExperiences: WorkExperience[] = [
  {
    company: "Bitscale",
    logo: "/org/bitscale.png",
    role: "Founding Engineer",
    period: "feb'25 - Now",
    url: "https://bitscale.ai/",
  },
  {
    company: "Flib",
    logo: "/org/flib.png",
    role: "Founder/CEO",
    period: "2023 - Now",
    url: "https://flib.store",
  },
  {
    company: "Zenduty",
    logo: "/org/zenduty.png",
    role: "Frontend Engineer Intern",
    period: "s'23 - s'24",
    url: "https://www.zenduty.com/",
  },
  {
    company: "Buildfast",
    logo: "/org/buildfast.jpeg",
    role: "Frontend Developer Intern",
    period: "Feb'23 - Mar'23",
    url: "https://www.buildfast.co.in/",
  },
  {
    company: "Google Code-In",
    logo: "/org/google.jpg",
    role: "Finalist | Score Lab",
    period: "Oct'18 - Dec'18",
    url: "https://codein.withgoogle.com/archive/2018/",
  },
];

const Work = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

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
        /work
      </motion.h1>

      {workExperiences.map((experience, index) => (
        <motion.a
          key={index}
          href={experience.url}
          target="_blank"
          variants={itemVariants}
          rel="noreferrer"
        >
          <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
            <div>
              <Image
                src={experience.logo || "/placeholder.svg"}
                height={37}
                width={37}
                className={`${
                  experience.logoRounded !== false ? "rounded-full" : ""
                } select-none`}
                alt={`${experience.company.toLowerCase()}-logo`}
                draggable="false"
              />
            </div>
            <div className="w-full pb-4 border-b border-secondary/40">
              <h1 className="font-medium">{experience.company}</h1>
              <div className="lowercase text-muted-foreground flex justify-between items-center">
                <p>{experience.role}</p>
                <p>{experience.period}</p>
              </div>
            </div>
          </div>
        </motion.a>
      ))}
    </motion.div>
  );
};

export default Work;
