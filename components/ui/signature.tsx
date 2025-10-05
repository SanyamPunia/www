"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

export default function Signature({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

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
        p.setAttribute("stroke-linecap", "butt");
        p.setAttribute("stroke-linejoin", "miter");
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
        p.style.opacity = "0.9";
      });

      gsap.to(paths, {
        strokeDashoffset: 0,
        duration: 2,
        ease: "power2.inOut",
        stagger: 0.08,
      });
    })();

    return () => {
      killed = true;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, []);

  return (
    <div className={`${className} text-white`}>
      <div ref={ref} className="size-32" />
    </div>
  );
}
