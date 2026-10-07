// Build for the Stars docs single-page application.
//
//   deno task build   # compile WASM core + render Markdown + emit dist/
//   deno task serve   # preview dist/ on http://localhost:8000
//
// The output is a static SPA: one index.html with client-side hash routing and an
// AssemblyScript (WASM) core used by the search box.

import { marked } from "npm:marked@15";

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

const ASSEMBLYSCRIPT = "npm:assemblyscript@0.28.2/bin/asc.js";

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

const read = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));

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

async function copyDir(from: URL, to: URL) {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    const src = new URL(entry.name + (entry.isDirectory ? "/" : ""), from);
    const dest = new URL(entry.name + (entry.isDirectory ? "/" : ""), to);
    if (entry.isDirectory) {
      await copyDir(src, dest);
    } else {
      await Deno.copyFile(src, dest);
    }
  }
}

async function compileWasm(outFile: URL) {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      ASSEMBLYSCRIPT,
      "assembly/index.ts",
      "--outFile",
      outFile.pathname.replace(/^\//, ""),
      "--runtime",
      "stub",
      "--optimizeLevel",
      "3",
      "--shrinkLevel",
      "1",
      "--noAssert",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await command.output();
  if (code !== 0) {
    throw new Error(`AssemblyScript build failed:\n${new TextDecoder().decode(stderr)}`);
  }
}

async function build() {
  const dist = new URL("./dist/", import.meta.url);
  await Deno.remove(dist, { recursive: true }).catch(() => {});
  await Deno.mkdir(dist, { recursive: true });

  const docs: DocPage[] = [];

  for (const page of pages) {
    const markdown = await read(page.file);
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

  await Deno.mkdir(new URL("./data/", dist), { recursive: true });
  await Deno.writeTextFile(
    new URL("./data/index.json", dist),
    JSON.stringify({ pages: docs }),
  );

  await copyDir(new URL("./assets/", import.meta.url), dist);
  await compileWasm(new URL("./core.wasm", dist));

  console.log(`✓ Built SPA — ${docs.length} pages + core.wasm`);
}

await build();
