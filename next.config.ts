import type { NextConfig } from "next";
import path from "node:path";

const canvasStub = path.resolve(process.cwd(), "stubs/canvas-stub.js");

const nextConfig: NextConfig = {
  /**
   * Next 16 warns when only `webpack` is set — Turbopack is often used for `next dev`.
   * Keep an explicit (possibly empty) `turbopack` block and mirror critical aliases there.
   */
  turbopack: {
    resolveAlias: {
      canvas: canvasStub,
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
