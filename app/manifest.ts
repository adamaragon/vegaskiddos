import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vegas Kiddos — Las Vegas Kids Events",
    short_name: "Vegas Kiddos",
    description: "Kid-safe Las Vegas family events by age, price & neighborhood.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8EE",
    theme_color: "#FF6B5E",
    categories: ["lifestyle", "kids", "events"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
