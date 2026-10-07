# Stars · documentación (SPA + WASM)

Documentación como **aplicación de una sola página (SPA)** construida con **Deno** y un
**núcleo WebAssembly en AssemblyScript** para la búsqueda. No hay servidor de aplicación: el
build produce archivos estáticos y el enrutado es en el cliente (hash routing).

## Requisitos

- [Deno](https://deno.com/) 2.x.

## Comandos

```bash
deno task build       # compila el WASM + renderiza el Markdown + emite dist/
deno task serve       # sirve dist/ en http://localhost:8000
deno task dev         # build + serve
deno task wasm        # compila solo el núcleo AssemblyScript → dist/core.wasm
deno task test:wasm   # prueba de humo del núcleo WASM
```

Puerto configurable: `PORT=9000 deno task serve`.

## Cómo funciona

- **`assembly/index.ts`** — núcleo en **AssemblyScript** compilado a `core.wasm`. Tokeniza y
  puntúa texto en memoria lineal (`score`, `occurrences`, `wordCount`). Sin binarios nativos: el
  compilador `asc` se ejecuta a través de Deno (`npm:assemblyscript`).
- **`build.ts`** — sin servidor. Lee `README.md` y `doc/*.md`, los convierte con [marked], añade
  anclas, reescribe enlaces a rutas `#/…`, envuelve bloques de código y emite:
  - `dist/index.html` — shell de la SPA
  - `dist/data/index.json` — páginas renderizadas + texto plano + encabezados
  - `dist/app/*.js` — aplicación (router, búsqueda, UI)
  - `dist/core.wasm` — núcleo de búsqueda
  - `dist/styles.css`
- **`assets/app/wasm.js`** — carga `core.wasm` y expone `setQuery`/`score` (con *fallback* en JS si
  el WASM no está disponible).
- **`assets/app/main.js`** — SPA: hash routing (`#/slug/anchor`), tabla de contenidos con
  scrollspy, búsqueda WASM, **menú lateral contraíble con iconos por sección** (preferencia
  persistida), tema claro/oscuro, revelado al hacer scroll y botones de copiar.
- **`server.ts`** — solo sirve `dist/` para previsualizar (con *fallback* de SPA).

Enrutado por hash: funciona desde `file://` y en GitHub Pages con subruta, sin configuración.

La **fuente de verdad es el Markdown**: edita `README.md` / `doc/*.md` y vuelve a ejecutar
`deno task build`.

## Despliegue en GitHub Pages

El workflow [`.github/workflows/docs.yml`](../.github/workflows/docs.yml) compila el sitio con Deno
(AssemblyScript incluido) y lo publica en GitHub Pages en cada push cuando cambian `doc/`,
`docs-site/` o el README.

1. Sube el repositorio a GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Lanza el workflow (push o *Run workflow*).

El sitio queda en `https://<usuario>.github.io/<repositorio>/`.

## Estructura

```
docs-site/
├── assembly/
│   ├── index.ts        # núcleo WASM (AssemblyScript)
│   └── tsconfig.json
├── assets/
│   ├── index.html      # shell de la SPA
│   ├── styles.css      # tema + animaciones
│   └── app/
│       ├── main.js     # router + UI + búsqueda
│       └── wasm.js     # cargador del núcleo WASM
├── build.ts            # generador estático
├── server.ts           # servidor de previsualización
├── test-wasm.ts        # smoke test del WASM
├── deno.json           # tareas
└── dist/               # salida generada (no versionar)
```

[marked]: https://marked.js.org/
