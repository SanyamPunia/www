"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";

export default function Signature({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(wrapperRef, { once: true, margin: "100px" });

  useEffect(() => {
    let killed = false;
    (async () => {
      const svgText = await fetch("/assets/signature.svg").then((r) =>
        r.text(),
      );
      if (killed || !ref.current) return;
      ref.current.innerHTML = svgText;

      const groups = ref.current.querySelectorAll<SVGGElement>("svg g");
      groups.forEach((g) => {
        g.removeAttribute("fill");
        g.removeAttribute("fill-opacity");
        g.style.fill = "none";
      });

      const paths = ref.current.querySelectorAll<SVGPathElement>("svg path");

      paths.forEach((p) => {
        const len = p.getTotalLength();
        p.removeAttribute("fill");
        p.style.fill = "none";
        p.setAttribute("stroke", "currentColor");
        p.setAttribute("stroke-width", "2.5");
        p.setAttribute("stroke-linecap", "round");
        p.setAttribute("stroke-linejoin", "round");
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        p.style.opacity = "0.9";
      });

      // inject a single keyframes style if not already present
      const styleId = "signature-draw-keyframes";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `@keyframes signatureDraw { to { stroke-dashoffset: 0; } }`;
        document.head.appendChild(style);
      }

      // if already in view, start animation immediately
      if (isInView) {
        paths.forEach((p, idx) => {
          (p as unknown as HTMLElement).style.animation =
            `signatureDraw 0.8s linear forwards ${0.5 + idx * 0.06}s`;
        });
      }
    })();

    return () => {
      killed = true;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [isInView]);

  // Start animation when it enters the viewport if SVG already loaded
  useEffect(() => {
    if (!ref.current || !isInView) return;
    const paths = ref.current.querySelectorAll<SVGPathElement>("svg path");
    paths.forEach((p, idx) => {
      const current = (p as unknown as HTMLElement).style.animation || "";
      if (!current.includes("signatureDraw")) {
        (p as unknown as HTMLElement).style.animation =
          `signatureDraw 0.8s linear forwards ${0.5 + idx * 0.06}s`;
      }
    });
  }, [isInView]);

  return (
    <div ref={wrapperRef} className={`${className} text-white`}>
      <div ref={ref} className="size-32" />
    </div>
  );
}
