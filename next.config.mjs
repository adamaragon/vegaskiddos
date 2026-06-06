/** @type {import('next').NextConfig} */

// Only opt into the custom image loader when an external image CDN is set
// (NEXT_PUBLIC_IMAGE_CDN — e.g. Bunny, used on Cloudflare Workers since workerd
// can't run sharp). A custom loader DISABLES Next's built-in /_next/image
// endpoint, which then 404s anywhere that doesn't provide its own optimizer —
// including `next dev` locally. So when no CDN is configured we fall back to the
// built-in optimizer: Netlify serves it via its Image CDN in prod, and dev
// serves it via sharp locally. See lib/imageLoader.ts.
const imageCdn = process.env.NEXT_PUBLIC_IMAGE_CDN;

const nextConfig = {
  images: {
    ...(imageCdn
      ? { loader: "custom", loaderFile: "./lib/imageLoader.ts" }
      : {}),
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
