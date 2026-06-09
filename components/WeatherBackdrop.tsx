"use client";

import { useMemo } from "react";

// Mood-specific animated overlays for the hero banner. All effects fade into
// the right half of the banner so the title on the left stays fully readable.
// CSS-only (transform/opacity) — no JS animation loop, GPU-friendly.

type Mood = "very_hot" | "hot" | "nice" | "chilly" | "cold" | "rainy" | "snow" | "storm" | "windy" | "fog" | "cloudy";

interface Props { mood: Mood; seed?: number }

// Deterministic pseudo-random so we don't trip React hydration. Each backdrop
// generates a fresh seed once per mount and never re-rolls — particles stay
// put after mount, only their CSS animation moves them.
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function RainDrops({ count = 28, intensity = 1 }: { count?: number; intensity?: number }) {
  const drops = useMemo(() => {
    const r = rand(7 + count);
    return Array.from({ length: count }).map(() => ({
      left: r() * 100,
      delay: r() * 1.6,
      duration: 0.6 + r() * 0.5,
      height: 12 + r() * 16,
      opacity: 0.35 + r() * 0.4 * intensity,
    }));
  }, [count, intensity]);
  return (
    <>
      {drops.map((d, i) => (
        <span
          key={i}
          className="wx-rain pointer-events-none absolute -top-4 w-px bg-gradient-to-b from-transparent via-white to-transparent"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animation: `wx-rain ${d.duration}s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function SnowFlakes({ count = 20 }: { count?: number }) {
  const flakes = useMemo(() => {
    const r = rand(13 + count);
    return Array.from({ length: count }).map(() => ({
      left: r() * 100,
      delay: r() * 6,
      duration: 5 + r() * 5,
      size: 4 + r() * 5,
    }));
  }, [count]);
  return (
    <>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="wx-snow pointer-events-none absolute rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            top: "-10%",
            width: `${f.size}px`,
            height: `${f.size}px`,
            animation: `wx-snow ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function WindWisps() {
  const wisps = useMemo(() => {
    const r = rand(29);
    return Array.from({ length: 5 }).map(() => ({
      top: 15 + r() * 70,
      delay: r() * 6,
      duration: 4 + r() * 4,
      width: 60 + r() * 80,
    }));
  }, []);
  return (
    <>
      {wisps.map((w, i) => (
        <span
          key={i}
          className="wx-drift pointer-events-none absolute h-px rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
          style={{
            top: `${w.top}%`,
            width: `${w.width}px`,
            animation: `wx-drift ${w.duration}s linear ${w.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

// Right-half mask so all effects fade into the corner instead of running edge-
// to-edge across the title. mask-image creates a smooth horizontal falloff.
function RightFade({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        maskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0) 100%)",
      }}
    >
      {children}
    </div>
  );
}

export function WeatherBackdrop({ mood }: Props) {
  if (mood === "storm") {
    return (
      <RightFade>
        <RainDrops count={36} intensity={1.2} />
        <div
          className="wx-flash absolute inset-0 bg-white"
          style={{ animation: "wx-flash 8s ease-in-out infinite" }}
        />
      </RightFade>
    );
  }
  if (mood === "rainy") {
    return <RightFade><RainDrops /></RightFade>;
  }
  if (mood === "snow") {
    return <RightFade><SnowFlakes /></RightFade>;
  }
  if (mood === "windy") {
    return <RightFade><WindWisps /></RightFade>;
  }
  if (mood === "very_hot" || mood === "hot") {
    // Warm radial glow on the right side + slow shimmer. No falling particles.
    return (
      <RightFade>
        <div
          className="wx-rays absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side at 80% 25%, rgba(255,220,120,0.55) 0%, rgba(255,180,90,0.22) 35%, transparent 70%)",
            animation: "wx-rays 6s ease-in-out infinite",
          }}
        />
        <div
          className="wx-shimmer absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 6px)",
            animation: "wx-shimmer 4s ease-in-out infinite",
          }}
        />
      </RightFade>
    );
  }
  if (mood === "cloudy" || mood === "fog") {
    return (
      <RightFade>
        <div
          className="wx-fog absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 80% 40%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 40%, transparent 70%)",
            animation: "wx-fog 8s ease-in-out infinite",
          }}
        />
      </RightFade>
    );
  }
  if (mood === "chilly" || mood === "cold") {
    // Faint cool tint, no particles unless it's actually snowing.
    return (
      <RightFade>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side at 80% 30%, rgba(180,220,255,0.3) 0%, transparent 65%)",
          }}
        />
      </RightFade>
    );
  }
  // "nice" — no effect needed, the gradient already feels great.
  return null;
}
