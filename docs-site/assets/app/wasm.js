// Loads the AssemblyScript (WASM) search core and exposes a tiny JS wrapper.
//
//   const api = await initWasm();
//   api.setQuery("opus");           // tokenize + store query in WASM memory
//   api.score("Opus codec");        // -> relevance score (int)

let wasm = null;
let queryLen = 0;

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function writeBytes(pointer, capacity, text) {
  const encoded = new TextEncoder().encode(text);
  const length = Math.min(encoded.length, capacity);
  // Re-create the view every time: memory growth detaches old buffers.
  const memory = new Uint8Array(wasm.memory.buffer);
  memory.set(encoded.subarray(0, length), pointer);
  return length;
}

export async function initWasm(url = "core.wasm") {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const imports = {
      env: {
        abort: (message, file, line, column) => {
          console.error(`WASM abort: ${message} (${file}:${line}:${column})`);
        },
        seed: () => Date.now(),
      },
    };
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    wasm = instance.exports;
    return true;
  } catch (error) {
    console.warn("WASM core unavailable, falling back to JS search:", error);
    wasm = null;
    return false;
  }
}

export function isReady() {
  return wasm !== null;
}

export function setQuery(text) {
  if (!wasm) return;
  const normalized = normalize(text);
  queryLen = writeBytes(wasm.queryBuffer(), wasm.queryCapacity(), normalized);
}

/** Returns a relevance score for the given text (0 = no match). */
export function score(text) {
  if (!wasm || queryLen === 0) return 0;
  const normalized = normalize(text);
  const length = writeBytes(wasm.textBuffer(), wasm.textCapacity(), normalized);
  return wasm.score(length, queryLen);
}

/* ---- Pure-JS fallback used when WASM cannot be loaded ------------------- */

function jsTokens(value) {
  return normalize(value).split(/[^a-z0-9]+/).filter(Boolean);
}

export function jsScore(text, query) {
  const haystack = jsTokens(text);
  const needles = jsTokens(query);
  if (needles.length === 0 || haystack.length === 0) return 0;

  let total = 0;
  for (const needle of needles) {
    const index = haystack.indexOf(needle);
    if (index >= 0) {
      total += 100;
      if (index === 0) total += 40;
    }
  }
  return total;
}
