"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { BlogMeta } from "@/lib/blogs";

export default function BlogsIndex({ blogs }: { blogs: BlogMeta[] }) {
  return (
    <div className="flex flex-col gap-6 sm:py-16 py-12 sm:px-8 px-0 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-4"
      >
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
        >
          <ArrowLeft className="size-3 transition-all group-hover:-translate-x-0.5" />
          back to home
        </a>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.08, delayChildren: 0.4 },
          },
        }}
      >
        <motion.h1
          className="text-sm lowercase font-medium mb-2 text-text-primary"
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
          blogs
        </motion.h1>
        <motion.p
          className="text-sm text-text-secondary lowercase leading-5"
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
          technical insights, project breakdowns, and development experiences. I
          occasionally write and share details about what i&apos;ve implemented
          and how i&apos;ve done it.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch"
      >
        {blogs.length === 0 ? (
          <p className="text-sm text-text-secondary lowercase col-span-full">
            coming soon...
          </p>
        ) : (
          blogs.map((post, index) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.08, duration: 0.4 }}
              className="flex-1"
            >
              <Link href={`/blogs/${post.slug}`} className="group block h-full">
                <div className="lowercase rounded-md p-4 border border-[#1e1e1e] hover:border-[#282828] transition-colors bg-neutral-900/30 h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm text-text-primary pr-6 group-hover:underline underline-offset-4 decoration-neutral-700">
                      {post.title}
                    </h2>
                    <ArrowUpRight className="size-3 text-text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-xs text-text-secondary mt-1 leading-5 flex-1">
                    {post.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-text-secondary">
                    <span className="text-[0.70em] px-2 py-0.5 rounded-sm border border-[#1e1e1e]">
                      {post.date}
                    </span>
                    <span className="text-[0.70em] px-2 py-0.5 rounded-sm border border-[#1e1e1e]">
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}
