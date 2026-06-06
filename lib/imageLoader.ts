// Custom next/image loader.
//
// When NEXT_PUBLIC_IMAGE_CDN is set (the Bunny pull zone — e.g.
// https://media.vegaskiddos.com, whose origin is vegaskiddos.com), image
// optimization is served THROUGH Bunny: the browser requests
// `${CDN}/_next/image?...`, Bunny pulls `vegaskiddos.com/_next/image?...`
// once, caches the optimized result, and serves it from Bunny's free-egress
// CDN thereafter. That moves the image bandwidth off the origin/Netlify.
//
// No-op when the env var is unset: returns the default same-origin
// `/_next/image` URL, so the live site is unaffected until this is enabled
// (set NEXT_PUBLIC_IMAGE_CDN + redeploy). NEXT_PUBLIC_ vars are inlined at
// build time, so flipping it requires a rebuild.
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const params = `url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
  const cdn = process.env.NEXT_PUBLIC_IMAGE_CDN?.replace(/\/$/, "");
  return cdn ? `${cdn}/_next/image?${params}` : `/_next/image?${params}`;
}
