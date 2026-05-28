"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

// Wraps children in a scroll-triggered reveal. Adds `is-visible` when the
// element scrolls into view (one-shot). Variants map to CSS in globals.css.
export function Reveal({
  children,
  variant = "",
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  variant?: "" | "pop";
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add("is-visible");
    };

    // Already in view on mount (e.g. above the fold) → reveal right away.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      show();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show();
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);

    // Fail-safe: never let content stay hidden if the observer misfires.
    const fallback = window.setTimeout(show, 2500);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [delay]);

  const cls = `reveal ${variant === "pop" ? "reveal-pop" : ""} ${className}`.trim();
  return <Tag ref={ref} className={cls}>{children}</Tag>;
}
