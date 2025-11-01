"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { NowPlaying as NowPlayingType } from "@/types";

export default function NowPlaying() {
  const [data, setData] = useState<NowPlayingType>({ isPlaying: false });

  useEffect(() => {
    let mounted = true;
    const fetchNow = async () => {
      try {
        const res = await fetch("/api/now-playing", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as NowPlayingType;
        if (mounted) setData(json);
      } catch {
        // no-op
      }
    };
    fetchNow();
    const id = setInterval(fetchNow, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (!data.isPlaying) {
    return null;
  }

  return (
    <motion.p
      className="text-sm text-text-secondary lowercase leading-5 mb-6"
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
      p.s. currently listening to{" "}
      <a
        href={data.songUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 transition-all hover:text-text-primary group"
      >
        {data.title}
      </a>{" "}
      by {data.artist}.
    </motion.p>
  );
}
