const fs = require("node:fs");
const path = require("node:path");

// Self-host the exact engine installed with the viewer. No runtime CDN request.
const viewer = require.resolve("@embedpdf/react-pdf-viewer");
const { createRequire } = require("node:module");
const viewerRequire = createRequire(viewer);
const snippet = viewerRequire.resolve("@embedpdf/snippet");
const version = JSON.parse(fs.readFileSync(path.join(path.dirname(snippet), "../package.json"), "utf8")).version;
const destination = path.join(__dirname, "../public/vendor/embedpdf", version);
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(path.dirname(snippet), "pdfium.wasm"), path.join(destination, "pdfium.wasm"));
console.log(`Prepared EmbedPDF ${version} engine`);
