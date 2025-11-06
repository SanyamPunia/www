"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProgressiveHeart } from "@/components/ui/progressive-heart";
import { cn, playTapSound } from "@/lib/utils";

const STORAGE_KEY_PREFIX = "blog-liked-";
const REQUEST_TIMEOUT = 10000; // 10 seconds

export function BlogLikeButton() {
  const pathname = usePathname();
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const slug = pathname?.replace("/blogs/", "") || "";
  const storageKey = `${STORAGE_KEY_PREFIX}${slug}`;
  const isBlogPage = pathname?.startsWith("/blogs/") && slug;

  useEffect(() => {
    if (!isBlogPage) return;

    // cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isBlogPage]);

  useEffect(() => {
    if (!isBlogPage) return;

    async function fetchLikes() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/blogs/${slug}/likes`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.count !== undefined) {
          setLikeCount(data.count);
          if (typeof window !== "undefined") {
            const stored = localStorage.getItem(storageKey);
            setIsLiked(stored === "true");
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Error fetching likes:", err);
        }
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(storageKey);
          setIsLiked(stored === "true");
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchLikes();
  }, [slug, storageKey, isBlogPage]);

  const handleLike = async () => {
    if (isLiked || isSubmitting || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSubmitting(true);
    const previousCount = likeCount;
    const previousLiked = isLiked;

    // optimistic update
    setIsLiked(true);
    setLikeCount(previousCount + 1);
    playTapSound();

    try {
      const timeoutId = setTimeout(
        () => abortController.abort(),
        REQUEST_TIMEOUT,
      );

      const response = await fetch(`/api/blogs/${slug}/likes`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && typeof data.count === "number") {
        setLikeCount(data.count);
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, "true");
        }
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setIsLiked(previousLiked);
      setLikeCount(previousCount);

      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Error liking blog:", err);
      }
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  if (!isBlogPage) return null;

  const isDisabled = isLiked || isSubmitting || isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-text-secondary">
        <Heart className="size-4 animate-pulse" />
        <div className="h-4 w-2.5 rounded bg-neutral-800 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.button
      onClick={handleLike}
      disabled={isDisabled}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
      className={cn(
        "flex items-center gap-1.5 rounded-md transition-all duration-150 text-xs",
        isDisabled
          ? "text-text-secondary cursor-not-allowed opacity-60"
          : "text-text-secondary hover:text-text-primary hover:bg-neutral-800/50 cursor-pointer",
      )}
      aria-label={
        isLiked
          ? "Already liked this post"
          : isSubmitting
            ? "Liking post..."
            : "Like this post"
      }
      aria-busy={isSubmitting}
    >
      <motion.div
        key={`heart-${isLiked ? "liked" : "unliked"}`}
        initial={{ scale: 0.8, filter: "blur(4px)" }}
        animate={{ scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <ProgressiveHeart
          isLiked={isLiked}
          width={16}
          height={16}
          className={cn(
            "size-4",
            isLiked ? "text-emerald-400" : "text-text-secondary",
            isSubmitting && "opacity-70",
          )}
        />
      </motion.div>
      <span className="font-medium">{likeCount}</span>
    </motion.button>
  );
}
