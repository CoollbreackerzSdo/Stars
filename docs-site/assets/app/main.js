// Stars docs — single-page application.
// Hash routing (#/slug/anchor), client-side rendering and WASM-powered search.

import { initWasm, isReady, setQuery, score, jsScore } from "./wasm.js";

const state = {
  pages: [],
  bySlug: new Map(),
  entries: [],
  wasmReady: false,
};

const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

/* ======================================================================== */
/* Boot                                                                      */
/* ======================================================================== */

async function boot() {
  try {
    const response = await fetch("data/index.json");
    const data = await response.json();
    state.pages = data.pages;
    for (const page of state.pages) state.bySlug.set(page.slug, page);
  } catch (error) {
    $("content").innerHTML = `<h1>Error</h1><p>No se pudo cargar la documentación (${error}).</p>`;
    return;
  }

  buildNav();
  buildSearchEntries();
  wireChrome();
  playIntro();

  state.wasmReady = await initWasm("core.wasm");

  addEventListener("hashchange", route);
  route();
}

/* ======================================================================== */
/* Navigation & routing                                                      */
/* ======================================================================== */

// Inline SVG icons keyed by page slug (Feather-style, minimal).
const ICONS = {
  index: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  overview: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  architecture: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  protocol: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="19" cy="17" r="1.6"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  client: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  transports: '<path d="M4 7h11a6 6 0 0 1 0 12H7"/><path d="m7 4 0 3-3 0"/>',
  ui: '<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/>',
  build: '<path d="M5 3v6l7 3 7-3V3"/><path d="M9 21h6M12 12v9"/>',
  troubleshooting: '<path d="M12 3a6 6 0 0 0-6 6v4l-1.5 3h15L18 13V9a6 6 0 0 0-6-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  roadmap: '<path d="M4 20V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14"/><path d="M4 20h16"/><path d="M10 7h8"/><path d="M10 11h8"/><path d="M17 4h2a1 1 0 0 1 1 1v14"/><circle cx="8" cy="9" r="1.4"/>',
};

function iconFor(slug) {
  const body = ICONS[slug] ?? ICONS.overview;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function buildNav() {
  const nav = $("nav");
  nav.innerHTML = state.pages
    .map(
      (p) =>
        `<a class="nav-link" data-slug="${p.slug}" href="#/${p.slug}" title="${escapeHtml(p.label)}">` +
        `<span class="nav-icon">${iconFor(p.slug)}</span>` +
        `<span class="sidebar-label">${escapeHtml(p.label)}</span>` +
        `</a>`,
    )
    .join("");
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  const slug = parts.length ? parts[0] : "index";
  const anchor = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
  return { slug, anchor };
}

function route() {
  const { slug, anchor } = parseRoute();
  const page = state.bySlug.get(slug) ?? state.bySlug.get("index");

  $("content").innerHTML = page.html;
  document.title = `${page.title} · Stars`;

  document.querySelectorAll("#nav .nav-link").forEach((a) => {
    const active = a.dataset.slug === page.slug;
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  buildToc(page, slug);
  enhanceArticle();
  observeReveal();

  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) {
      target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      return;
    }
  }
  scrollTo({ top: 0, behavior: "auto" });
}

/* ======================================================================== */
/* Table of contents + scrollspy                                             */
/* ======================================================================== */

let scrollSpy = null;

function buildToc(page, slug) {
  const nav = $("tocNav");
  scrollSpy?.disconnect();

  if (page.headings.length === 0) {
    nav.innerHTML = "";
    return;
  }

  nav.innerHTML = page.headings
    .map((h) => `<a class="toc-link" href="#/${slug}/${h.id}">${escapeHtml(h.text)}</a>`)
    .join("");

  const links = Array.from(nav.querySelectorAll(".toc-link"));
  const headings = page.headings
    .map((h) => document.getElementById(h.id))
    .filter(Boolean);

  scrollSpy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((l) =>
        l.classList.toggle("active", l.getAttribute("href") === `#/${slug}/${entry.target.id}`),
      );
    }
  }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });

  headings.forEach((h) => scrollSpy.observe(h));
  if (links[0]) links[0].classList.add("active");
}

/* ======================================================================== */
/* Article enhancements: copy buttons + scroll reveal                        */
/* ======================================================================== */

function enhanceArticle() {
  document.querySelectorAll("#content .code-block .copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyCode(btn));
  });
  document.querySelectorAll("#content .heading-anchor").forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      location.hash = anchor.getAttribute("href").slice(1);
    });
  });
}

async function copyCode(btn) {
  const code = btn.parentElement?.querySelector("code")?.innerText ?? "";
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const area = document.createElement("textarea");
    area.value = code;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    area.remove();
  }
  btn.textContent = "¡Copiado!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = "Copiar";
    btn.classList.remove("copied");
  }, 1400);
}

let revealObserver = null;

function observeReveal() {
  revealObserver?.disconnect();
  const targets = document.querySelectorAll("#content > *");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("reveal", "is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

  targets.forEach((el, index) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(index, 8) * 40}ms`;
    revealObserver.observe(el);
  });
}

/* ======================================================================== */
/* Search (WASM)                                                             */
/* ======================================================================== */

function buildSearchEntries() {
  for (const page of state.pages) {
    // Full page body (so queries match any word in the content).
    state.entries.push({
      text: page.text,
      title: page.title,
      group: page.label,
      url: `#/${page.slug}`,
    });
    // Every heading, so results can deep-link to a section.
    for (const heading of page.headings) {
      state.entries.push({
        text: `${heading.text} ${page.title}`,
        title: heading.text,
        group: page.title,
        url: `#/${page.slug}/${heading.id}`,
      });
    }
  }
}

let activeResult = -1;

function search(query) {
  const q = query.trim();
  const box = $("searchResults");
  box.innerHTML = "";
  activeResult = -1;

  if (!q) {
    box.classList.add("hidden");
    return;
  }

  if (state.wasmReady) setQuery(q);

  const scored = [];
  for (const entry of state.entries) {
    const value = state.wasmReady ? score(entry.text) : jsScore(entry.text, q);
    if (value > 0) scored.push({ entry, value });
  }

  scored.sort((a, b) => b.value - a.value);
  const top = scored.slice(0, 12);

  if (top.length === 0) {
    box.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400">Sin resultados</div>';
    box.classList.remove("hidden");
    return;
  }

  for (const { entry } of top) {
    const link = document.createElement("a");
    link.href = entry.url;
    link.className = "search-result";
    link.innerHTML =
      `<span class="block text-slate-800 dark:text-slate-100">${escapeHtml(entry.title)}</span>` +
      `<span class="block text-xs text-slate-400">${escapeHtml(entry.group)}</span>`;
    link.addEventListener("click", () => box.classList.add("hidden"));
    box.appendChild(link);
  }
  box.classList.remove("hidden");
}

function moveResult(delta) {
  const box = $("searchResults");
  const items = Array.from(box.querySelectorAll(".search-result"));
  if (items.length === 0) return;
  activeResult = (activeResult + delta + items.length) % items.length;
  items.forEach((el, i) => el.classList.toggle("active", i === activeResult));
  items[activeResult]?.scrollIntoView({ block: "nearest" });
}

/* ======================================================================== */
/* Chrome: theme, menu, progress, back-to-top                               */
/* ======================================================================== */

function wireChrome() {
  const themeBtn = $("themeBtn");
  const applyTheme = (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    themeBtn.textContent = dark ? "☀" : "☾";
  };
  applyTheme(document.documentElement.classList.contains("dark"));
  themeBtn.addEventListener("click", () => {
    const dark = !document.documentElement.classList.contains("dark");
    try { localStorage.setItem("stars-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
    applyTheme(dark);
  });

  $("menuBtn").addEventListener("click", () => {
    $("sidebar").classList.toggle("-translate-x-full");
    $("overlay").classList.toggle("hidden");
  });
  $("overlay").addEventListener("click", closeMenu);

  const collapseBtn = $("collapseBtn");
  collapseBtn.addEventListener("click", () => {
    const collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
    try { localStorage.setItem("stars-sidebar", collapsed ? "collapsed" : "expanded"); } catch { /* ignore */ }
  });

  const progress = $("progress");
  const topbar = $("topbar");
  const toTop = $("toTop");
  let ticking = false;

  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progress.style.width = `${max > 0 ? (doc.scrollTop / max) * 100 : 0}%`;
    topbar.classList.toggle("scrolled", doc.scrollTop > 8);
    toTop.classList.toggle("visible", doc.scrollTop > 400);
  };
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();

  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" }));

  const input = $("search");
  input.addEventListener("input", (e) => search(e.target.value));
  input.addEventListener("focus", (e) => search(e.target.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveResult(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveResult(-1); }
    else if (e.key === "Enter") {
      const items = $("searchResults").querySelectorAll(".search-result");
      const target = items[activeResult < 0 ? 0 : activeResult];
      if (target) target.click();
    } else if (e.key === "Escape") {
      $("searchResults").classList.add("hidden");
      input.blur();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (!$("searchResults").contains(e.target) && e.target !== input) {
      $("searchResults").classList.add("hidden");
    }
  });
}

function closeMenu() {
  $("sidebar")?.classList.add("-translate-x-full");
  $("overlay")?.classList.add("hidden");
}

function playIntro() {
  if (prefersReduced) return;
  const root = document.documentElement;
  root.classList.add("intro");
  setTimeout(() => root.classList.remove("intro"), 900);
}

/* ======================================================================== */
/* Utils                                                                     */
/* ======================================================================== */

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

boot();
