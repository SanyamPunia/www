"use client";

import { motion } from "framer-motion";
import { useAnimationInView } from "@/hooks/use-animation";
import { FaSoundcloud, FaSpotify, FaYoutube } from "react-icons/fa";
import React, { JSX } from "react";

type MusicPlatform = {
  name: string;
  url: string;
  icon: JSX.Element;
  color: string;
};

const musicPlatforms: MusicPlatform[] = [
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/prodmxle",
    icon: (
      <FaSoundcloud className="inline-block mb-0.5" size={17} color="#ff7700" />
    ),
    color: "#ff7700",
  },
  {
    name: "Spotify",
    url: "https://open.spotify.com/artist/2QbtOIjb8mUIsnCNqvyWAW?nd=1&dlsi=d5f341b22e524b63",
    icon: (
      <FaSpotify className="inline-block mb-0.5" size={17} color="#1DB954" />
    ),
    color: "#1DB954",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/@prodmxle",
    icon: (
      <FaYoutube className="inline-block mb-0.5" size={17} color="#FF0000" />
    ),
    color: "#FF0000",
  },
];

export const Music = () => {
  const { ref, isInView, itemVariants } =
    useAnimationInView(0.2);

  return (
    <motion.div
      className="mt-16 sm:-mx-2 text-xs"
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={itemVariants}
    >
      <motion.h1
        className="text-xs text-muted-foreground mb-3"
        variants={itemVariants}
      >
        /music
      </motion.h1>

      <motion.p
        className="mb-3 text-sm lowercase px-3 py-2 -mx-3 text-muted-foreground"
        variants={itemVariants}
      >
        In 2020, I released my music online, reaching over{" "}
        <span className="text-white font-semibold">150,000</span> plays across
        platforms, including{" "}
        <span className="text-white font-semibold">100,000+</span> on SoundCloud
        in 1.5 years.
      </motion.p>

      <motion.p
        className="mb-3 text-sm lowercase px-3 py-2 -mx-3 text-muted-foreground"
        variants={itemVariants}
      >
        I usually release music on{" "}
        {musicPlatforms.map((platform, index) => (
          <React.Fragment key={platform.name}>
            <a
              href={platform.url}
              target="_blank"
              className="border border-gray-400/15 rounded-md bg-border py-[1px] px-[4px] inline-block space-x-2 transition-all hover:text-primary"
              rel="noreferrer"
            >
              <code>{platform.name}</code>
              {platform.icon}
            </a>
            {index < musicPlatforms.length - 1 &&
              index === musicPlatforms.length - 2
              ? ", and "
              : index < musicPlatforms.length - 1
                ? ", "
                : ""}
          </React.Fragment>
        ))}
        . Feel free to check them out.
      </motion.p>
    </motion.div>
  );
};
