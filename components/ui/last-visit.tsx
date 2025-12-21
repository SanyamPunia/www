"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TextEncrypted } from "./text-encrypted";

interface LastVisitData {
  city: string | null;
  country: string | null;
  timestamp?: number | null;
}

export function LastVisit() {
  const [lastVisit, setLastVisit] = useState<LastVisitData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [displayText, setDisplayText] = useState<string>("");

  useEffect(() => {
    const fetchLastVisit = async () => {
      try {
        const response = await fetch("/api/last-visit");
        const data = (await response.json()) as LastVisitData;

        setLastVisit(data);
      } catch (error) {
        console.error("Error fetching last visit:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const updateLocation = async () => {
      try {
        await fetch("/api/last-visit", {
          method: "POST",
        });

        // refetch after update
        await fetchLastVisit();
      } catch (error) {
        console.error("Error updating location:", error);

        // try to refetch after error
        await fetchLastVisit();
      }
    };

    updateLocation();
  }, []);

  useEffect(() => {
    if (lastVisit?.city && lastVisit?.country) {
      setDisplayText(`last visit from ${lastVisit.city}, ${lastVisit.country}`);
    }
  }, [lastVisit]);

  if (isLoading || !lastVisit?.city || !lastVisit?.country) {
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
