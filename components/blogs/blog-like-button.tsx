"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ProgressiveHeart } from "@/components/ui/progressive-heart";
import { useBlogLike } from "@/hooks/use-blog-likes";
import { cn, playTapSound } from "@/lib/utils";

const STORAGE_KEY_PREFIX = "blog-liked-";

export function BlogLikeButton() {
  const pathname = usePathname();
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const slug = pathname?.replace("/blogs/", "") || "";
  const storageKey = `${STORAGE_KEY_PREFIX}${slug}`;
  const isBlogPage = pathname?.startsWith("/blogs/") && slug;

  useEffect(() => {
    if (!isBlogPage) return;

    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(storageKey);
    setIsLiked(stored === "true");
  }, [storageKey, isBlogPage]);

  const { data, isLoading, mutate } = useBlogLike(isBlogPage ? slug : null, {
    revalidateOnMount: true,
  });

  const likeCount = data?.count ?? 0;

  const handleLike = async () => {
    if (!slug || !isBlogPage) return;
    if (isLiked || isSubmitting || isLoading) return;

    setIsSubmitting(true);
    setIsLiked(true);
    playTapSound();

    const optimisticCount = likeCount + 1;

    try {
      await mutate(
        async () => {
          const response = await fetch(`/api/blogs/${slug}/likes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const payload = await response.json();
          const nextCount =
            typeof payload?.count === "number"
              ? payload.count
              : optimisticCount;

          if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, "true");
          }

          return { count: nextCount };
        },
        {
          optimisticData: { count: optimisticCount },
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        },
      );
    } catch (err) {
      setIsLiked(false);

      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }

      if (err instanceof Error) {
        console.error("Error liking blog:", err);
      }
    } finally {
      setIsSubmitting(false);
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
