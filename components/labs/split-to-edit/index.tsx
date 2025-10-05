"use client";

import { LayoutGroup, motion } from "framer-motion";
import { Poppins } from "next/font/google";
import { useRef, useState } from "react";
import { CheckSm } from "./icons/check";
import { PencilSolid } from "./icons/pencil";
import "./styles.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const page = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [bordersSettled, setBordersSettled] = useState(true);
  const borderTimerRef = useRef<number | null>(null);
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("0");
  const hoursRef = useRef<HTMLSpanElement | null>(null);
  const minutesRef = useRef<HTMLSpanElement | null>(null);

  const getDigits = (text: string) => text.replace(/\D/g, "");
  const clamp = (num: number, min: number, max: number) =>
    Math.max(min, Math.min(max, num));

  const commitEdits = () => {
    const rawH = getDigits(hoursRef.current?.innerText || "");
    const rawM = getDigits(minutesRef.current?.innerText || "");
    const newH = rawH === "" ? "0" : String(clamp(parseInt(rawH, 10), 0, 999));
    const newM = rawM === "" ? "0" : String(clamp(parseInt(rawM, 10), 0, 59));
    setHours(newH);
    setMinutes(newM);
  };

  const settleBordersAfter = (ms = 150) => {
    setBordersSettled(false);
    if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
    borderTimerRef.current = window.setTimeout(() => {
      setBordersSettled(true);
      borderTimerRef.current = null;
    }, ms);
  };

  const handlePencilClick = () => {
    if (isEditing) {
      commitEdits();
      settleBordersAfter(150);
    }
    setIsEditing((v) => !v);
  };

  return (
    <div className="flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      <div
        className={`flex flex-col items-center justify-center ${poppins.className}`}
      >
        <LayoutGroup>
          {isEditing ? (
            <div className="flex flex-row items-center gap-6">
              <motion.div
                layout
                layoutId="seg-hr"
                className="text-sm font-semibold bg-neutral-900 rounded-xl h-12 w-20 flex items-center justify-between px-4"
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span
                  layout
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  ref={hoursRef}
                  className="outline-none focus:outline-none focus:ring-0 text-white"
                >
                  {hours}
                </motion.span>
                <motion.span className="text-neutral-400" layout>
                  Hr.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-min"
                className="text-sm font-semibold bg-neutral-900 rounded-xl h-12 w-[85px] flex items-center justify-between px-4"
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span
                  layout
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  ref={minutesRef}
                  className="outline-none focus:outline-none focus:ring-0 text-white"
                >
                  {minutes}
                </motion.span>
                <motion.span className="text-neutral-400" layout>
                  Min.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-icon"
                className="bg-neutral-900 rounded-xl h-12 w-16 flex items-center justify-center px-4 cursor-pointer"
                onClick={handlePencilClick}
              >
                <motion.div
                  key="check"
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <CheckSm className="size-4 text-neutral-400" />
                </motion.div>
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-row items-center">
              <motion.div
                layout
                layoutId="seg-hr"
                className={`text-sm font-semibold bg-neutral-900 border border-neutral-900 h-12 px-4 -mr-3 flex items-center justify-between space-x-0.5 ${
                  bordersSettled ? "rounded-l-xl" : "rounded-xl"
                }`}
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span layout className="text-white">
                  {hours || "0"}
                </motion.span>
                <motion.span className="text-neutral-400" layout>
                  Hr.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-min"
                className={`text-sm font-semibold bg-neutral-900 h-12 px-4 -mr-3 flex items-center justify-between space-x-0.5 ${
                  bordersSettled ? "" : "rounded-xl"
                }`}
                transition={{ layout: { duration: 0.25, ease: "easeInOut" } }}
              >
                <motion.span layout className="text-white">
                  {minutes === "" ? "0" : minutes}
                </motion.span>
                <motion.span className="text-neutral-400" layout>
                  Min.
                </motion.span>
              </motion.div>
              <motion.div
                layout
                layoutId="seg-icon"
                className={`bg-neutral-900 h-12 px-4 cursor-pointer flex items-center justify-center ${
                  bordersSettled ? "rounded-r-xl" : "rounded-xl"
                }`}
                onClick={handlePencilClick}
              >
                <motion.div
                  key="pencil"
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <PencilSolid className="size-4 text-neutral-400" />
                </motion.div>
              </motion.div>
            </div>
          )}
        </LayoutGroup>
      </div>
    </div>
  );
};

export default page;
