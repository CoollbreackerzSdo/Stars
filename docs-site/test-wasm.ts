// Ad-hoc smoke test for the WASM search core (run with: deno run -A test-wasm.ts)
const bytes = await Deno.readFile(new URL("./dist/core.wasm", import.meta.url));
const imports = { env: { abort: () => {}, seed: () => 1 } };
const { instance } = await WebAssembly.instantiate(bytes, imports);
const e = instance.exports as Record<string, CallableFunction> & { memory: WebAssembly.Memory };

const enc = new TextEncoder();
const write = (ptr: number, cap: number, text: string) =>
  enc.encodeInto(text, new Uint8Array(e.memory.buffer, ptr, cap)).written!;

let qlen = 0;
const setQuery = (q: string) => {
  qlen = write(e.queryBuffer() as number, e.queryCapacity() as number, q);
};
const score = (text: string) => {
  const len = write(e.textBuffer() as number, e.textCapacity() as number, text);
  return e.score(len, qlen) as number;
};

console.log("exports:", Object.keys(e).join(", "));

setQuery("opus");
console.log("score('opus codec 48khz') =", score("opus codec 48khz"));
console.log("score('wasapi loopback')  =", score("wasapi loopback"));

setQuery("wasapi loopback");
console.log("score('WASAPI loopback capture') =", score("wasapi loopback capture"));
console.log("score('opus codec')              =", score("opus codec"));

const words = write(e.textBuffer() as number, e.textCapacity() as number, "hola mundo 42");
console.log("wordCount('hola mundo 42') =", e.wordCount(words));
