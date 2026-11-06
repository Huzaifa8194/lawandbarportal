/* eslint-disable @typescript-eslint/no-require-imports */
// Browser integration fixture: node tests/pdf-viewer-browser.cjs, then open
// http://127.0.0.1:3099. Uses the actual React viewer and its local WASM engine.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const webpackModule = process.argv.includes("--serve") ? null : require("next/dist/compiled/webpack/webpack");

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".next/pdf-smoke");

function fixturePdf() {
  const text = "BT /F1 22 Tf 50 720 Td (PDF viewer integration test) Tj 0 -40 Td (Select this text to highlight and add comments.) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = "%PDF-1.7\n"; const offsets = [0];
  objects.forEach((object, i) => {offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;});
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

function serve() {
  http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/fixture.pdf" || url.pathname === "/invalid.pdf") {
      response.setHeader("Content-Type", "application/pdf"); response.end(url.pathname === "/fixture.pdf" ? fixturePdf() : "%PDF-invalid"); return;
    }
    if (url.pathname.startsWith("/vendor/embedpdf/") && url.pathname.endsWith("/pdfium.wasm")) {
      response.setHeader("Content-Type", "application/wasm"); response.end(fs.readFileSync(path.join(root, "public", url.pathname))); return;
    }
    if (url.pathname.endsWith(".js") && fs.existsSync(path.join(out, path.basename(url.pathname)))) { response.setHeader("Content-Type", "text/javascript"); response.end(fs.readFileSync(path.join(out, path.basename(url.pathname)))); return; }
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:system-ui}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1}.min-h-0{min-height:0}.h-full{height:100%}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.z-30{z-index:30}.overflow-hidden{overflow:hidden}*{box-sizing:border-box}#root{height:100vh}#root>div>div>div{height:100%}</style></head><body><div id="root"></div><script src="/viewer.js"></script></body></html>');
  }).listen(3099, "127.0.0.1", () => console.log("PDF browser fixture ready: http://127.0.0.1:3099"));
}
if (process.argv.includes("--serve")) serve();
else {
webpackModule.webpack({
  mode: "development", devtool: false, context: root, target: "web",
  entry: path.join(__dirname, "pdf-viewer-smoke.tsx"),
  output: {path: out, filename: "viewer.js"},
  resolve: {extensions: [".tsx", ".ts", ".js"], alias: {"@": root}},
  module: {rules: [{test: /\.tsx?$/, exclude: /node_modules/, use: path.join(__dirname, "pdf-smoke-loader.cjs")}]},
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({all: false, errors: true})); process.exitCode = 1; return; }
  console.log("PDF browser bundle compiled. Start with --serve.");
});
}
