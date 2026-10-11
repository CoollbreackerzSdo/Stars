// Build for the Stars docs single-page application.
//
//   bun run build   # compile WASM core + render Markdown + emit dist/
//   bun run serve   # preview dist/ on http://localhost:8000
//
// The output is a static SPA: one index.html with client-side hash routing and an
// AssemblyScript (WASM) core used by the search box.

import { marked } from "marked";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

interface Heading {
  id: string;
  text: string;
}

interface DocPage {
  slug: string;
  label: string;
  title: string;
  html: string;
  text: string;
  headings: Heading[];
}

const pages = [
  { file: "../README.md", slug: "index", label: "Inicio" },
  { file: "../doc/01-overview.md", slug: "overview", label: "1. Visión general" },
  { file: "../doc/02-architecture.md", slug: "architecture", label: "2. Arquitectura" },
  { file: "../doc/03-protocol.md", slug: "protocol", label: "3. Protocolo" },
  { file: "../doc/04-server.md", slug: "server", label: "4. Servidor" },
  { file: "../doc/05-client.md", slug: "client", label: "5. Cliente" },
  { file: "../doc/06-transports.md", slug: "transports", label: "6. Transportes" },
  { file: "../doc/07-ui-and-animations.md", slug: "ui", label: "7. Interfaz y animaciones" },
  { file: "../doc/08-build-and-run.md", slug: "build", label: "8. Compilar y ejecutar" },
  { file: "../doc/09-troubleshooting.md", slug: "troubleshooting", label: "9. Solución de problemas" },
  { file: "../doc/10-roadmap.md", slug: "roadmap", label: "10. Hoja de ruta" },
];

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Adds ids to <h2>/<h3> plus anchor links, collecting them for the TOC and search. */
function addHeadingIds(html: string, slug: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Set<string>();

  const withIds = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const text = stripTags(inner);
    let id = slugify(text) || "section";
    let candidate = id;
    let n = 2;
    while (used.has(candidate)) candidate = `${id}-${n++}`;
    used.add(candidate);
    headings.push({ id: candidate, text });
    const anchor = '<a class="heading-anchor" href="#/' + slug + "/" + candidate + '" aria-label="Enlace">#</a>';
    return `<h${level} id="${candidate}">${inner}${anchor}</h${level}>`;
  });

  return { html: withIds, headings };
}

/** Rewrites repo-relative Markdown links to SPA hash routes. */
function rewriteLinks(html: string): string {
  return html.replace(/href="([^"]+?)\.md(#[^"]*)?"/g, (_m, path: string, hash = "") => {
    const base = path.split("/").pop();
    if (base === "README") return `href="#/${hash.replace("#", "/")}"`;
    const match = base?.match(/^(\d+)-(.+)$/);
    const slug = match ? match[2] : base;
    const suffix = hash ? "/" + hash.replace("#", "") : "";
    return `href="#/${slug}${suffix}"`;
  });
}

/** Wraps each code block so a copy button can be attached at runtime. */
function wrapCodeBlocks(html: string): string {
  return html
    .replace(
      /<pre>/g,
      '<div class="code-block"><button class="copy-btn" type="button" aria-label="Copiar código">Copiar</button><pre>',
    )
    .replace(/<\/pre>/g, "</pre></div>");
}

function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/);
  return match ? stripTags(match[1]) : fallback;
}

function copyDir(from: URL, to: URL) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = new URL(entry.name + (entry.isDirectory() ? "/" : ""), from);
    const dest = new URL(entry.name + (entry.isDirectory() ? "/" : ""), to);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      copyFileSync(src, dest);
    }
  }
}

function compileWasm(outFile: URL) {
  // asc sits in node_modules/assemblyscript/bin/asc.js; run it with the current runtime
  // (bun). fileURLToPath yields a native absolute path on every OS (Windows drive letters
  // included), which is what asc expects as --outFile.
  const asc = join(
    dirname(fileURLToPath(import.meta.url)),
    "node_modules",
    "assemblyscript",
    "bin",
    "asc.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      asc,
      "assembly/index.ts",
      "--outFile",
      fileURLToPath(outFile),
      "--runtime",
      "stub",
      "--optimizeLevel",
      "3",
      "--shrinkLevel",
      "1",
      "--noAssert",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`AssemblyScript build failed:\n${result.stderr || result.stdout}`);
  }
}

async function build() {
  const dist = new URL("./dist/", import.meta.url);
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  const docs: DocPage[] = [];

  for (const page of pages) {
    const markdown = read(page.file);
    const rawHtml = await marked.parse(markdown, { gfm: true });
    const linked = wrapCodeBlocks(rewriteLinks(rawHtml));
    const { html, headings } = addHeadingIds(linked, page.slug);
    const title = page.slug === "index" ? "Inicio" : extractTitle(rawHtml, page.label);

    docs.push({
      slug: page.slug,
      label: page.label,
      title,
      html,
      text: stripTags(html),
      headings,
    });
  }

  mkdirSync(new URL("./data/", dist), { recursive: true });
  writeFileSync(
    new URL("./data/index.json", dist),
    JSON.stringify({ pages: docs }),
  );

  copyDir(new URL("./assets/", import.meta.url), dist);
  compileWasm(new URL("./core.wasm", dist));

  console.log(`✓ Built SPA — ${docs.length} pages + core.wasm`);
}

await build();