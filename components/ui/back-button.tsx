"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { playTapSound } from "@/lib/utils";

interface BackButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function BackButton({
  href,
  children,
  className = "",
}: BackButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors group"
        onClick={playTapSound}
      >
        <ArrowLeft className="size-3 transition-all group-hover:-translate-x-0.5" />
        {children}
      </Link>
    </motion.div>
  );
}
