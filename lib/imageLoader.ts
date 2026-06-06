// Custom next/image loader.
//
// Image optimization differs by host:
//  - Netlify (legacy prod): NEXT_PUBLIC_IMAGE_CDN unset -> same-origin
//    /_next/image, which Netlify optimizes server-side.
//  - Cloudflare Worker (OpenNext): the Worker CANNOT resize images (no sharp
//    on workerd) — /_next/image returns the full-size original (~1.7MB). So
//    route through an external optimizing CDN via NEXT_PUBLIC_IMAGE_CDN.
//
// Two CDN shapes are supported, auto-detected from the host:
//  - Bunny (https://media.vegaskiddos.com): pull-zone passthrough. Bunny pulls
//    the origin's /_next/image and its Optimizer (WebP compression + Dynamic
//    image API width= + Smart optimization) shrinks it. ~4KB webp. (paid)
//  - wsrv.nl (https://images.weserv.nl): free resizer. ~3.8KB webp.
//
// No-op when NEXT_PUBLIC_IMAGE_CDN is unset, so legacy Netlify is unaffected.
// NEXT_PUBLIC_ vars are inlined at build time -> flipping requires a rebuild.
const SITE_ORIGIN = "https://vegaskiddos.com";

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const cdn = process.env.NEXT_PUBLIC_IMAGE_CDN?.replace(/\/$/, "");
  const q = quality || 75;

  if (!cdn) {
    // Same-origin: Netlify optimizes; the Worker passes through unoptimized.
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
  }

  if (/weserv|wsrv/.test(cdn)) {
    // wsrv.nl needs an absolute source URL; prefix relative srcs.
    const abs = src.startsWith("http")
      ? src
      : `${SITE_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
    return `${cdn}/?url=${encodeURIComponent(abs)}&w=${width}&q=${q}&output=webp`;
  }

  // Bunny (or any same-shape pull zone): pass through the origin's /_next/image
  // path and let the Optimizer resize/convert. width= drives Bunny's Dynamic
  // image API; WebP compression kicks in via the client's Accept header.
  return `${cdn}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}&width=${width}&quality=${q}`;
}
