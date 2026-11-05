import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Resolve from react-pdf so the worker always matches its PDF.js runtime.
const pdfWorker = createRequire(require.resolve("react-pdf")).resolve("pdfjs-dist/build/pdf.worker.min.mjs");

const canvasStub = path.resolve(process.cwd(), "stubs/canvas-stub.js");

const nextConfig: NextConfig = {
  /**
   * Next 16 warns when only `webpack` is set — Turbopack is often used for `next dev`.
   * Keep an explicit (possibly empty) `turbopack` block and mirror critical aliases there.
   */
  turbopack: {
    resolveAlias: {
      canvas: canvasStub,
      "pdf-worker": pdfWorker,
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      "pdf-worker": pdfWorker,
    };
    return config;
  },
};

export default nextConfig;
