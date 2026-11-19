import type { NextConfig } from "next";

const apiUrl = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000");

const nextConfig: NextConfig = {
  // E2E runs build into a separate folder so it never clashes with a developer's running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      { source: "/:path((?!admin/tickets/scan$).*)", headers: [...base, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] },
      // The ticket scanner is the only page that may ask for the camera (and only after the checker presses Start).
      { source: "/admin/tickets/scan", headers: [...base, { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }] },
    ];
  },
  images: {
    // Catalogue images are served by the Laravel API's public storage.
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
        pathname: "/storage/**",
      },
    ],
    // Set ALLOW_LOCAL_IMAGE_HOST=true only for local development, where the API is on localhost (a private address Next refuses by default).
    dangerouslyAllowLocalIP: process.env.ALLOW_LOCAL_IMAGE_HOST === "true",
  },
};

export default nextConfig;
