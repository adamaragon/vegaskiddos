"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sun, Cloud, RainCloud, StormCloud, Snowflake, WindSwirl } from "@/components/Doodles";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { useLang } from "@/lib/lang-client";
import { t, type StringKey } from "@/lib/i18n";

// Live weather pill for the homepage hero. Hits Open-Meteo (free, no API key)
// once on mount, classifies the current Las Vegas conditions, and renders both
// a big spinning crayon doodle (changes glyph by mood) and a compact pill with
// the label + temperature. When it's hot or stormy, the pill links to
// /beat-the-heat so families can pivot to indoor events with one tap.

type Mood = "very_hot" | "hot" | "nice" | "chilly" | "cold" | "rainy" | "snow" | "storm" | "windy" | "fog" | "cloudy";

interface Weather {
  tempF: number;
  mood: Mood;
  emoji: string;
  labelKey: StringKey;
  Doodle: typeof Sun;
}

// Test-mode fixtures: each mood mapped to a (temp, code, wind) tuple chosen so
// classify() returns that exact mood. Exercised via `?wx=<mood>` on the URL —
// e.g. /?wx=rainy /?wx=storm /?wx=very_hot. Skipped in real use.
const MOCK_INPUTS: Record<Mood, [number, number, number]> = {
  very_hot: [108, 0, 5],
  hot: [95, 0, 5],
  nice: [75, 0, 5],
  chilly: [55, 0, 5],
  cold: [38, 0, 5],
  rainy: [65, 63, 5],
  snow: [32, 73, 5],
  storm: [70, 95, 5],
  windy: [78, 1, 30],
  fog: [50, 45, 5],
  cloudy: [68, 3, 5],
};

// Weather code reference: https://open-meteo.com/en/docs (WMO codes).
function classify(tempF: number, code: number, windMph: number): Weather {
  if (code >= 95) return { tempF, mood: "storm", emoji: "⛈️", labelKey: "wx_storm", Doodle: StormCloud };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { tempF, mood: "snow", emoji: "❄️", labelKey: "wx_snow", Doodle: Snowflake };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { tempF, mood: "rainy", emoji: "🌧️", labelKey: "wx_rainy", Doodle: RainCloud };
  if (code === 45 || code === 48) return { tempF, mood: "fog", emoji: "🌫️", labelKey: "wx_fog", Doodle: Cloud };
  if (windMph >= 25) return { tempF, mood: "windy", emoji: "💨", labelKey: "wx_windy", Doodle: WindSwirl };
  if (tempF >= 100) return { tempF, mood: "very_hot", emoji: "🥵", labelKey: "wx_very_hot", Doodle: Sun };
  if (tempF >= 88) return { tempF, mood: "hot", emoji: "☀️", labelKey: "wx_hot", Doodle: Sun };
  if (tempF >= 60) {
    const cloudy = code === 2 || code === 3;
    return cloudy
      ? { tempF, mood: "cloudy", emoji: "🌤️", labelKey: "wx_cloudy", Doodle: Cloud }
      : { tempF, mood: "nice", emoji: "😎", labelKey: "wx_nice", Doodle: Sun };
  }
  if (tempF >= 45) return { tempF, mood: "chilly", emoji: "🍂", labelKey: "wx_chilly", Doodle: Cloud };
  return { tempF, mood: "cold", emoji: "🥶", labelKey: "wx_cold", Doodle: Snowflake };
}

const HOT_MOODS: Mood[] = ["very_hot", "hot"];
const INDOOR_LINK_MOODS: Mood[] = ["very_hot", "hot", "rainy", "storm", "snow"];

interface OpenMeteoCurrent {
  temperature_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
}

export function WeatherPill() {
  const lang = useLang();
  const tr = (k: StringKey) => t(lang, k);
  const [w, setW] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Dev override: `?wx=rainy` (or any mood) forces a specific weather state
    // for testing without waiting for the real conditions to match.
    const override = new URLSearchParams(window.location.search).get("wx");
    if (override && override in MOCK_INPUTS) {
      const [tF, code, wind] = MOCK_INPUTS[override as Mood];
      setW(classify(tF, code, wind));
      return;
    }

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=36.17&longitude=-115.14" +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph"
    )
      .then((r) => r.json())
      .then((d: { current?: OpenMeteoCurrent }) => {
        if (cancelled) return;
        const c = d.current;
        if (!c || typeof c.temperature_2m !== "number" || typeof c.weather_code !== "number") return;
        setW(classify(Math.round(c.temperature_2m), c.weather_code, c.wind_speed_10m ?? 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // SSR + initial paint: fall back to the original decorative sun so the hero
  // never looks empty while we wait for the fetch.
  if (!w) {
    return (
      <Sun
        className="pointer-events-none absolute right-6 top-6 h-24 w-24 animate-spin-slow opacity-30"
        color="#FFFFFF"
      />
    );
  }

  const { Doodle } = w;
  const label = tr(w.labelKey);
  const showIndoorHint = INDOOR_LINK_MOODS.includes(w.mood);
  const pillBody = (
    <>
      <span className="text-base leading-none sm:text-lg" aria-hidden>{w.emoji}</span>
      <span className="leading-none">{label} · {w.tempF}°F</span>
      {showIndoorHint && (
        <span className="hidden font-700 text-ink/60 sm:inline">· {tr("wx_indoor_hint")}</span>
      )}
    </>
  );

  // Dark text on a frosted-white pill is the most legible across every mood
  // (bright sun, dark storm, snow). The ring keeps the edge crisp on the
  // colorful hero gradient.
  const pillBase =
    "inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 text-base font-800 text-ink shadow-pop ring-1 ring-ink/10 backdrop-blur-md sm:px-4 sm:py-2.5 sm:text-lg";

  return (
    <>
      {/* Mood-specific animated backdrop faded into the right side of the
          banner. Renders no element for "nice" — the gradient is enough. */}
      <WeatherBackdrop mood={w.mood} />

      {/* Foreground pill nestled in the top-right corner. Linked to
          /beat-the-heat when it's a day families would want to pivot indoors. */}
      {showIndoorHint ? (
        <Link
          href="/beat-the-heat"
          className={`hover-pop absolute right-5 top-5 z-20 ${pillBase}`}
          aria-label={`${label} ${w.tempF}°F — see indoor events`}
        >
          {pillBody}
        </Link>
      ) : (
        <div
          className={`absolute right-5 top-5 z-20 ${pillBase}`}
          aria-label={`${label} ${w.tempF}°F`}
        >
          {pillBody}
        </div>
      )}

      {/* Larger spinning decorative doodle, tucked under the pill. Changes
          glyph by mood so the hero still has a hand-drawn flourish. */}
      <Doodle
        className={`pointer-events-none absolute right-6 top-28 z-10 h-24 w-24 opacity-45 sm:h-28 sm:w-28 ${HOT_MOODS.includes(w.mood) ? "animate-spin-slow" : "animate-float"}`}
        color="#FFFFFF"
      />
    </>
  );
}
