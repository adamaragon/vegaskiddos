// Hand-drawn, crayon-style SVG doodles used as decorative flair throughout the
// site. The <CrayonDefs/> filter gives strokes a rough, waxy, child-drawn edge.
// All decorative — aria-hidden, pointer-events none.

import type { CSSProperties } from "react";

export function CrayonDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        {/* Coarser, wavier displacement = a much more obvious waxy crayon edge. */}
        <filter id="crayonFilter" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045 0.06" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

type DoodleProps = {
  className?: string;
  style?: CSSProperties;
  color?: string;
};
const base = (c?: string) => ({
  stroke: c || "currentColor",
  strokeWidth: 5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
  filter: "url(#crayonFilter)",
});

export function Sun({ className, style, color = "#FFC93C" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <circle cx="50" cy="50" r="20" {...base(color)} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line key={i}
            x1={50 + Math.cos(a) * 28} y1={50 + Math.sin(a) * 28}
            x2={50 + Math.cos(a) * 42} y2={50 + Math.sin(a) * 42}
            {...base(color)} />
        );
      })}
    </svg>
  );
}

export function Star({ className, style, color = "#FF6B5E" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M50 12 L60 40 L90 42 L66 60 L75 90 L50 72 L25 90 L34 60 L10 42 L40 40 Z" {...base(color)} />
    </svg>
  );
}

export function Heart({ className, style, color = "#FF6B5E" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M50 84 C20 60 12 40 26 26 C38 14 50 26 50 34 C50 26 62 14 74 26 C88 40 80 60 50 84 Z" {...base(color)} />
    </svg>
  );
}

export function Cloud({ className, style, color = "#23C4B5" }: DoodleProps) {
  return (
    <svg viewBox="0 0 140 80" className={className} style={style} aria-hidden>
      <path d="M30 60 C10 60 10 36 30 36 C32 18 60 16 64 32 C70 18 98 20 96 38 C116 36 118 60 98 60 Z" {...base(color)} />
    </svg>
  );
}

// Weather variants — share the same hand-drawn crayon styling so they slot into
// the hero in place of <Sun /> when conditions change.

export function RainCloud({ className, style, color = "#FFFFFF" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M22 50 C8 50 8 30 22 30 C24 16 48 14 52 28 C58 16 82 18 80 32 C96 30 98 50 80 50 Z" {...base(color)} />
      <line x1="32" y1="64" x2="28" y2="80" {...base(color)} />
      <line x1="50" y1="64" x2="46" y2="84" {...base(color)} />
      <line x1="68" y1="64" x2="64" y2="80" {...base(color)} />
    </svg>
  );
}

export function StormCloud({ className, style, color = "#FFFFFF" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M22 46 C8 46 8 26 22 26 C24 12 48 10 52 24 C58 12 82 14 80 28 C96 26 98 46 80 46 Z" {...base(color)} />
      <path d="M50 50 L40 72 L52 72 L42 92" {...base(color)} strokeWidth={6} />
    </svg>
  );
}

export function Snowflake({ className, style, color = "#FFFFFF" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * Math.PI) / 3;
        const x = 50 + Math.cos(a) * 38;
        const y = 50 + Math.sin(a) * 38;
        const bx = 50 + Math.cos(a + 0.45) * 22;
        const by = 50 + Math.sin(a + 0.45) * 22;
        const cx = 50 + Math.cos(a - 0.45) * 22;
        const cy = 50 + Math.sin(a - 0.45) * 22;
        return (
          <g key={i}>
            <line x1={50} y1={50} x2={x} y2={y} {...base(color)} />
            <line x1={bx} y1={by} x2={x - (x-bx)*0.4} y2={y - (y-by)*0.4} {...base(color)} strokeWidth={3} />
            <line x1={cx} y1={cy} x2={x - (x-cx)*0.4} y2={y - (y-cy)*0.4} {...base(color)} strokeWidth={3} />
          </g>
        );
      })}
    </svg>
  );
}

export function WindSwirl({ className, style, color = "#FFFFFF" }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M10 35 C30 25 50 35 70 30 C82 27 86 18 80 14" {...base(color)} />
      <path d="M10 58 C35 48 60 58 80 52 C94 48 96 36 88 32" {...base(color)} />
      <path d="M10 80 C28 72 46 80 62 76 C72 73 75 65 70 62" {...base(color)} />
    </svg>
  );
}

export function Squiggle({ className, style, color = "#7B5EA7" }: DoodleProps) {
  return (
    <svg viewBox="0 0 200 30" className={className} style={style} aria-hidden>
      <path d="M5 15 Q25 0 45 15 T85 15 T125 15 T165 15 T200 15" {...base(color)} />
    </svg>
  );
}

export function Scribble({ className, style, color = "#FFC93C" }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
      <path d="M20 60 C20 30 50 20 70 35 C90 50 70 80 50 75 C30 70 40 40 65 45 C85 49 80 70 60 68" {...base(color)} strokeWidth={6} />
    </svg>
  );
}

export function Arrow({ className, style, color = "#23C4B5" }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 80" className={className} style={style} aria-hidden>
      <path d="M10 50 C40 10 70 70 105 25" {...base(color)} />
      <path d="M90 18 L107 22 L98 38" {...base(color)} />
    </svg>
  );
}

// A crayon underline that animates its stroke when revealed (pair with `draw-line reveal`).
export function Underline({ className, style, color = "#FFC93C" }: DoodleProps) {
  return (
    <svg viewBox="0 0 300 24" className={className} style={style} aria-hidden preserveAspectRatio="none">
      <path d="M6 14 C70 4 150 22 220 10 C255 4 280 12 294 9" {...base(color)} strokeWidth={8} />
    </svg>
  );
}
