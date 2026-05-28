import { ImageResponse } from "next/og";

export const alt = "Vegas Kiddos — kid-safe Las Vegas family events";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded default social-share image, generated at build/edge.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FF6B5E 0%, #FFC93C 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 120 }}>🌵</div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 8 }}>Vegas Kiddos</div>
        <div style={{ fontSize: 38, marginTop: 16, opacity: 0.95, maxWidth: 900 }}>
          Kid-safe Las Vegas events by age, price &amp; neighborhood
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 36,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {["👶 Baby", "🧸 Toddler", "🎨 Kids", "🛹 Tweens"].map((t) => (
            <div key={t} style={{ background: "rgba(255,255,255,0.22)", padding: "10px 22px", borderRadius: 999 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
