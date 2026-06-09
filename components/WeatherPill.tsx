"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sun, Cloud, RainCloud, StormCloud, Snowflake, WindSwirl } from "@/components/Doodles";
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
      <span className="text-base" aria-hidden>{w.emoji}</span>
      <span>{label} · {w.tempF}°F</span>
      {showIndoorHint && (
        <span className="hidden text-white/75 sm:inline">· {tr("wx_indoor_hint")}</span>
      )}
    </>
  );

  return (
    <>
      {/* Big spinning decorative weather doodle — changes glyph by mood. */}
      <Doodle
        className={`pointer-events-none absolute right-6 top-6 h-24 w-24 opacity-30 ${HOT_MOODS.includes(w.mood) ? "animate-spin-slow" : "animate-float"}`}
        color="#FFFFFF"
      />
      {/* Foreground pill with the label + temp. Linked to /beat-the-heat when
          it's a day families would want to pivot indoors. */}
      {showIndoorHint ? (
        <Link
          href="/beat-the-heat"
          className="hover-pop absolute right-6 top-32 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-sm font-700 text-white shadow-pop backdrop-blur-sm"
          aria-label={`${label} ${w.tempF}°F — see indoor events`}
        >
          {pillBody}
        </Link>
      ) : (
        <div
          className="absolute right-6 top-32 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-sm font-700 text-white shadow-pop backdrop-blur-sm"
          aria-label={`${label} ${w.tempF}°F`}
        >
          {pillBody}
        </div>
      )}
    </>
  );
}
