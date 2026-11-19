import type { NextConfig } from "next";

/**
 * Static export: `next build` writes the whole site to out/, which is uploaded to the domain folder on shared
 * hosting next to the Laravel API (backend/). There is no Node server, so:
 * - all data is fetched in the browser;
 * - pages for one record read their id from the query string (see src/lib/routes.ts);
 * - security headers and URL rewrites live in the root .htaccess written by .github/workflows/deploy-backend.yml.
 */
const nextConfig: NextConfig = {
  output: "export",
  // /movies/ -> movies/index.html, so Apache serves every page as a directory index.
  trailingSlash: true,
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
  images: {
    // No image optimisation server on static hosting: catalogue images are served as uploaded.
    unoptimized: true,
  },
};

export default nextConfig;
