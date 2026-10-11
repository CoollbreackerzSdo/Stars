// Static file server for the generated documentation.
// Usage: bun run serve   (or `bun server.ts`)
import { readFile } from "node:fs/promises";

const root = new URL("./dist/", import.meta.url);
const port = Number(process.env.PORT ?? 8000);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

Bun.serve({
  port,
  async fetch(request) {
    let path = decodeURIComponent(new URL(request.url).pathname);
    // SPA: the app uses hash routing, so every document request maps to index.html.
    if (path === "/" || !path.includes(".")) path = "/index.html";

    try {
      const data = await readFile(new URL("." + path, root));
      const ext = path.slice(path.lastIndexOf("."));
      return new Response(data, {
        headers: {
          "content-type": contentTypes[ext] ?? "application/octet-stream",
          "cache-control": "no-cache",
        },
      });
    } catch {
      return new Response("404 — Not found", { status: 404 });
    }
  },
});

console.log(`Stars docs → http://localhost:${port}`);