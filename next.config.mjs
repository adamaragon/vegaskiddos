/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Custom loader: routes optimization through NEXT_PUBLIC_IMAGE_CDN (Bunny)
    // when set; default same-origin /_next/image otherwise. See lib/imageLoader.ts.
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
