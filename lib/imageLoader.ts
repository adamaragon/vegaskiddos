// Custom next/image loader.
//
// Image optimization differs by host:
//  - Netlify (current prod): NEXT_PUBLIC_IMAGE_CDN unset -> same-origin
//    /_next/image, which Netlify optimizes server-side.
//  - Cloudflare Worker (OpenNext): the Worker CANNOT resize images (no sharp
//    on workerd) — /_next/image returns the full-size original (~1.7MB).
//    So route through an external resizing CDN by setting NEXT_PUBLIC_IMAGE_CDN
//    to a wsrv.nl-compatible base (https://images.weserv.nl). wsrv resizes +
//    converts to webp + caches (free). Cloudflare Image Transformations would
//    be a paid drop-in alternative with a different URL shape.
//
// No-op when NEXT_PUBLIC_IMAGE_CDN is unset, so the live Netlify site is
// unaffected until this is enabled. NEXT_PUBLIC_ vars are inlined at build
// time, so flipping the env var requires a rebuild + redeploy.
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

  // wsrv.nl-compatible resizer. It needs an absolute source URL; relative
  // srcs (local assets) are served by the site origin, so prefix them.
  const abs = src.startsWith("http")
    ? src
    : `${SITE_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
  return `${cdn}/?url=${encodeURIComponent(abs)}&w=${width}&q=${q}&output=webp`;
}
