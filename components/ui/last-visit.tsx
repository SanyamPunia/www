"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  isLocalEnv,
  type LastVisitData,
  lastVisitFetcher,
} from "@/lib/last-visit";
import { TextEncrypted } from "./text-encrypted";

export function LastVisit() {
  const [displayText, setDisplayText] = useState<string>("");
  const [shouldUpdate, setShouldUpdate] = useState(false);

  const {
    data: lastVisit,
    isLoading,
    mutate,
  } = useSWR<LastVisitData>(
    isLocalEnv ? null : "/api/last-visit",
    lastVisitFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );

  useEffect(() => {
    if (isLocalEnv || shouldUpdate) return;

    const updateLocation = async () => {
      try {
        await fetch("/api/last-visit", {
          method: "POST",
        });
        setShouldUpdate(true);
        await mutate();
      } catch (error) {
        console.error("Error updating location:", error);
      }
    };

    updateLocation();
  }, [mutate, shouldUpdate]);

  useEffect(() => {
    if (lastVisit?.city && lastVisit?.country) {
      setDisplayText(`last visit from ${lastVisit.city}, ${lastVisit.country}`);
    }
  }, [lastVisit]);

  if (isLocalEnv || isLoading || !lastVisit?.city || !lastVisit?.country) {
    return null;
  }

  return (
    <motion.div
      className="fixed bottom-4 right-4 text-xs lowercase z-50"
      initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.6 }}
    >
      <TextEncrypted text={displayText} interval={50} />
    </motion.div>
  );
}
