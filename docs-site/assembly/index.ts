// AssemblyScript core for the Stars docs SPA.
//
// The browser writes normalized (lowercase, accent-free) strings into the two scratch
// buffers below and then calls these functions with the byte lengths. Keeping the hot
// tokenization / matching loop in WASM keeps search snappy on linear memory.

const textBuf = new Uint8Array(1 << 16); // 64 KiB of text
const queryBuf = new Uint8Array(512);

/** Address of the text scratch buffer for JS to write into. */
export function textBuffer(): usize {
  return textBuf.dataStart;
}

export function textCapacity(): i32 {
  return textBuf.length;
}

/** Address of the query scratch buffer for JS to write into. */
export function queryBuffer(): usize {
  return queryBuf.dataStart;
}

export function queryCapacity(): i32 {
  return queryBuf.length;
}

// Only [a-z0-9] run together as tokens; JS guarantees normalized input.
function isTokenByte(b: u8): bool {
  return (b >= 0x61 && b <= 0x7a) || (b >= 0x30 && b <= 0x39);
}

function tokenEquals(
  hay: Uint8Array, hs: i32, he: i32,
  needle: Uint8Array, ns: i32, ne: i32,
): bool {
  const hl = he - hs;
  const nl = ne - ns;
  if (hl == 0 || nl == 0 || hl != nl) return false;
  for (let i = 0; i < hl; i++) {
    if (hay[hs + i] != needle[ns + i]) return false;
  }
  return true;
}

/**
 * Scores a text against a query: one point per query token that appears in the text.
 * A token found at the very start of the text (typically the title) earns a bonus.
 */
export function score(textLen: i32, queryLen: i32): i32 {
  if (textLen <= 0 || queryLen <= 0) return 0;

  let total = 0;
  let qi = 0;
  while (qi < queryLen) {
    while (qi < queryLen && !isTokenByte(queryBuf[qi])) qi++;
    const qs = qi;
    while (qi < queryLen && isTokenByte(queryBuf[qi])) qi++;
    const qe = qi;
    if (qe == qs) continue;

    let ti = 0;
    let firstToken = true;
    while (ti < textLen) {
      while (ti < textLen && !isTokenByte(textBuf[ti])) ti++;
      const ts = ti;
      while (ti < textLen && isTokenByte(textBuf[ti])) ti++;
      const te = ti;
      if (te == ts) continue;

      if (tokenEquals(textBuf, ts, te, queryBuf, qs, qe)) {
        total += 100;
        if (firstToken) total += 40; // title / leading-token bonus
        break;
      }
      firstToken = false;
    }
  }
  return total;
}

/** Total number of times the query's tokens appear in the text. */
export function occurrences(textLen: i32, queryLen: i32): i32 {
  if (textLen <= 0 || queryLen <= 0) return 0;

  let total = 0;
  let qi = 0;
  while (qi < queryLen) {
    while (qi < queryLen && !isTokenByte(queryBuf[qi])) qi++;
    const qs = qi;
    while (qi < queryLen && isTokenByte(queryBuf[qi])) qi++;
    const qe = qi;
    if (qe == qs) continue;

    let ti = 0;
    while (ti < textLen) {
      while (ti < textLen && !isTokenByte(textBuf[ti])) ti++;
      const ts = ti;
      while (ti < textLen && isTokenByte(textBuf[ti])) ti++;
      const te = ti;
      if (te == ts) continue;
      if (tokenEquals(textBuf, ts, te, queryBuf, qs, qe)) total++;
    }
  }
  return total;
}

/** Number of alphanumeric tokens in the text. */
export function wordCount(textLen: i32): i32 {
  let count = 0;
  let ti = 0;
  while (ti < textLen) {
    while (ti < textLen && !isTokenByte(textBuf[ti])) ti++;
    const ts = ti;
    while (ti < textLen && isTokenByte(textBuf[ti])) ti++;
    if (ti > ts) count++;
  }
  return count;
}
