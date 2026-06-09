"use client";

import { useMemo } from "react";
import { Cloud } from "@/components/Doodles";

// Mood-specific animated overlays for the hero banner. All effects fade into
// the right half of the banner so the title on the left stays fully readable.
// CSS-only (transform/opacity) — no JS animation loop, GPU-friendly.

type Mood = "very_hot" | "hot" | "nice" | "chilly" | "cold" | "rainy" | "snow" | "storm" | "windy" | "fog" | "cloudy";

interface Props { mood: Mood; seed?: number }

// Full-banner mood wash. Sits between the hero's coral-sunny gradient and the
// right-side particle effects, so the brand color still hints through (60-80%
// opacity range) but the dominant tone matches the weather. Null = leave the
// hot/sunny default exposed.
//
// Colors drawn from the brand palette: teal #23C4B5 / dark #0FA89A,
// grape #7B5EA7 / dark #664A8F, sunny #FFC93C / dark #F2B705,
// coral #FF6B5E / dark #E8503F, ink #2D2A32.
const MOOD_OVERLAY: Record<Mood, string | null> = {
  nice: null,
  hot: null,
  very_hot: null,
  windy:
    "linear-gradient(135deg, rgba(242,183,5,0.55) 0%, rgba(232,80,63,0.45) 100%)",
  cloudy:
    "linear-gradient(135deg, rgba(123,94,167,0.55) 0%, rgba(35,196,181,0.55) 100%)",
  fog:
    "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(123,94,167,0.45) 100%)",
  chilly:
    "linear-gradient(135deg, rgba(35,196,181,0.65) 0%, rgba(123,94,167,0.55) 100%)",
  cold:
    "linear-gradient(135deg, rgba(15,168,154,0.75) 0%, rgba(102,74,143,0.7) 100%)",
  rainy:
    "linear-gradient(135deg, rgba(15,168,154,0.78) 0%, rgba(102,74,143,0.78) 100%)",
  storm:
    "linear-gradient(135deg, rgba(102,74,143,0.85) 0%, rgba(45,42,50,0.85) 100%)",
  snow:
    "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(35,196,181,0.45) 100%)",
};

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

function RainDrops({ count = 40, intensity = 1 }: { count?: number; intensity?: number }) {
  const drops = useMemo(() => {
    const r = rand(7 + count);
    // Bias drops toward the right ~85% so the fading edge stays sparse instead
    // of wasting particles in the masked-out region.
    return Array.from({ length: count }).map(() => ({
      left: 15 + r() * 85,
      delay: r() * 1.6,
      duration: 0.6 + r() * 0.5,
      height: 14 + r() * 18,
      opacity: 0.45 + r() * 0.4 * intensity,
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

function SnowFlakes({ count = 30 }: { count?: number }) {
  const flakes = useMemo(() => {
    const r = rand(13 + count);
    return Array.from({ length: count }).map(() => ({
      left: 10 + r() * 90,
      delay: r() * 6,
      duration: 5 + r() * 5,
      size: 5 + r() * 6,
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

function CloudPuffs({ count = 5, dense = false }: { count?: number; dense?: boolean }) {
  const puffs = useMemo(() => {
    const r = rand(41 + count + (dense ? 1 : 0));
    return Array.from({ length: count }).map(() => ({
      top: 5 + r() * 75,             // spread across the banner height
      delay: r() * 18,                // stagger so they don't enter together
      duration: 18 + r() * 14,        // slow drift, 18-32s
      widthPx: 60 + r() * 90,         // 60-150px wide cloud
      opacity: (dense ? 0.6 : 0.45) + r() * 0.25,
    }));
  }, [count, dense]);
  return (
    <>
      {puffs.map((p, i) => (
        <div
          key={i}
          className="wx-drift pointer-events-none absolute"
          style={{
            top: `${p.top}%`,
            opacity: p.opacity,
            animation: `wx-drift ${p.duration}s linear ${p.delay}s infinite`,
          }}
        >
          <Cloud
            color="#FFFFFF"
            style={{ width: `${p.widthPx}px`, height: "auto" }}
          />
        </div>
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

// Particles run full-strength across the right ~half of the banner, then taper
// off so the title on the far left stays readable. mask-image gives a smooth
// horizontal falloff — full visibility 0-55% from the right, fading out by
// 95% so only the leftmost title margin is clean.
function RightFade({ children }: { children: React.ReactNode }) {
  const mask =
    "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0.65) 78%, rgba(0,0,0,0.2) 92%, rgba(0,0,0,0) 100%)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}

function moodEffects(mood: Mood) {
  if (mood === "storm") {
    return (
      <RightFade>
        <RainDrops count={52} intensity={1.3} />
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
    const rayStrength = mood === "very_hot" ? 0.55 : 0.4;
    return (
      <RightFade>
        {/* Conic-gradient sun rays radiating from the top-right corner,
            slowly rotating + pulsing so they shimmer. */}
        <div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg at 85% 15%,
              rgba(255,230,140,${rayStrength}) 0deg,
              transparent 7deg,
              rgba(255,210,110,${rayStrength * 0.7}) 14deg,
              transparent 22deg,
              rgba(255,225,140,${rayStrength * 0.85}) 30deg,
              transparent 40deg,
              rgba(255,200,100,${rayStrength * 0.6}) 50deg,
              transparent 62deg,
              rgba(255,235,150,${rayStrength * 0.9}) 75deg,
              transparent 88deg,
              rgba(255,210,110,${rayStrength * 0.5}) 100deg,
              transparent 360deg)`,
            animation: "wx-ray-spin 60s linear infinite, wx-ray-pulse 5s ease-in-out infinite",
          }}
        />
        {/* Tight warm glow at the sun anchor point. */}
        <div
          className="wx-rays absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side at 85% 15%, rgba(255,240,170,0.7) 0%, rgba(255,200,110,0.35) 25%, transparent 55%)",
            animation: "wx-rays 6s ease-in-out infinite",
          }}
        />
        {/* Subtle horizontal shimmer stripes. */}
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
  if (mood === "fog") {
    // Tangible cloud bank: lots of overlapping puffs at varying sizes and
    // depths so the banner looks soft-buried in cloud rather than just dim.
    return (
      <RightFade>
        <CloudPuffs count={7} dense />
      </RightFade>
    );
  }
  if (mood === "cloudy") {
    // Lighter scattering — a few cloud shapes lazily drifting through.
    return (
      <RightFade>
        <CloudPuffs count={4} />
      </RightFade>
    );
  }
  // chilly / cold / nice — overlay alone carries the mood, no extra particles.
  return null;
}

export function WeatherBackdrop({ mood }: Props) {
  const overlay = MOOD_OVERLAY[mood];
  const effects = moodEffects(mood);
  if (!overlay && !effects) return null;
  return (
    <>
      {overlay && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: overlay }}
        />
      )}
      {effects}
    </>
  );
}
