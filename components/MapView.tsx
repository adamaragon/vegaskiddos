"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KidEvent } from "@/lib/types";
import { LV_CENTER, priceTier } from "@/lib/constants";

const PIN_COLOR: Record<string, string> = {
  free: "#23C4B5",
  under10: "#FFC93C",
  mid: "#FF6B5E",
  premium: "#7B5EA7",
};

export function MapView({ events }: { events: KidEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const router = useRouter();
  // Flips true once the map + layer are ready, so the markers effect re-runs
  // after the async init finishes (it used to lose the race and never render).
  const [ready, setReady] = useState(false);

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      try { await import("leaflet.markercluster"); } catch { /* fall back to plain layer */ }
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: LV_CENTER,
        zoom: 11,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      // Cluster nearby pins when available; otherwise a plain layer group.
      const cluster = (L as unknown as { markerClusterGroup?: (o?: object) => import("leaflet").LayerGroup }).markerClusterGroup;
      layerRef.current = cluster
        ? cluster({ maxClusterRadius: 50, showCoverageOnHover: false })
        : L.layerGroup();
      map.addLayer(layerRef.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-render markers whenever the filtered events change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || !layerRef.current) return;
      const layer = layerRef.current;
      layer.clearLayers();

      const valid = events.filter((e) => e.lat && e.lng);
      valid.forEach((e) => {
        const color = PIN_COLOR[e.priceTier] || "#FF6B5E";
        const icon = L.divIcon({
          className: "kk-pin",
          html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        const marker = L.marker([e.lat, e.lng], { icon }).addTo(layer);
        const price = priceTier(e.priceTier);
        marker.bindPopup(
          `<strong style="font-size:14px">${e.title}</strong><br/>` +
            `<span style="color:#666">${e.venue}</span><br/>` +
            `<span style="display:inline-block;margin-top:4px">${price.emoji} ${price.label}</span><br/>` +
            `<a href="/event/${e.id}" style="color:#FF6B5E;font-weight:700">View details →</a>`
        );
        marker.on("popupopen", () => {
          const el = document.querySelector(`a[href="/event/${e.id}"]`);
          el?.addEventListener(
            "click",
            (ev) => {
              ev.preventDefault();
              router.push(`/event/${e.id}`);
            },
            { once: true }
          );
        });
      });

      if (valid.length) {
        const bounds = L.latLngBounds(valid.map((e) => [e.lat, e.lng]));
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [events, router, ready]);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] min-h-[420px] w-full rounded-blob border border-ink/10 shadow-card"
    />
  );
}
