# PISAStyle

Preparación PISA en español, inglés y portugués: evaluación de nivel, unidades
de estudio con estímulo e ítems, e infografías de resultados.

> Contenido educativo **no oficial**, sin afiliación, patrocinio ni aprobación
> de la OCDE. Las cifras del informe PISA 2022 se citan con su fuente en cada
> página.

## Arrancar

```bash
pnpm install
pnpm run dev        # http://127.0.0.1:4321
```

| Comando | Qué hace |
|---|---|
| `pnpm run dev` | Servidor de desarrollo (Astro) |
| `pnpm run check` | `astro check` |
| `pnpm test` | Vitest — 125 tests |
| `pnpm run type-check` | `tsc --noEmit` |
| `pnpm run test:tokens` | Contraste WCAG de los tokens en ambos temas |
| `pnpm run build` | Build de producción (salida en `dist/`) |
| `pnpm run preview` | Sirve el build |

## Rutas

Todo el contenido vive bajo un locale: `/es`, `/en`, `/pt`.

| Ruta | Qué hace |
|---|---|
| `/[locale]/explorar` | Landing. Unidad con estímulo, contenido e ítems; infografía de rankings PISA 2022 |
| `/[locale]/evaluar` | Autoevaluación: 10 preguntas, devuelve el nivel por dominio y guarda el resultado |
| `/[locale]/metodo` | El método PISAStyle v1.1 |
| `/[locale]/novedades` | Novedades |

`/` y `/{locale}` redirigen a `/{locale}/explorar`. `[locale]/index.astro` existe
pero es **inalcanzable**: el middleware manda la raíz y el locale a `/explorar`,
así que la landing real es `/explorar`.

## Contenido: dónde vive y por qué

Las unidades **no están en el repositorio**. `LICENSE.md` punto 2 declara
privados los contenidos de preguntas y de `study_content`, y las unidades
llevan clave de respuestas. Viven en un vault privado:

```
~/.proyectosSWAL/.private/pisastyle/src/data/sample-<dominio>-<locale>.json
```

`src/lib/units.ts` las resuelve en tiempo de build con `import.meta.glob`
—relativo, no absoluto— porque Vite solo resuelve globs dentro del root del
proyecto, y el SSR corre en workerd (adapter de Cloudflare), que no tiene
sistema de ficheros: `readFileSync` daría error en cada petición.

La UI distingue tres estados:

- **vault**: hay unidad y se muestra, con aviso de que viene del vault.
- **sin unidad**: la página avisa en vez de fingir contenido.
- `origin: 'local'`: alguien creó un fichero en `src/data/`.

`scripts/private-material.sh` mueve el material sensible fuera del root y
documenta por qué: el dev server sirve por HTTP cualquier archivo del project
root, no solo los de `src/`.

## Stack

- **Astro 7**, `output: 'server'` con `@astrojs/cloudflare` (SSR en workerd)
- **Svelte 5** para los componentes interactivos; páginas e infografías en
  `.astro` estático
- **@swal/ui** como design system: tokens `--swal-*` y componentes. El CSS se
  importa desde el core, no se genera a mano en cada componente
- **@swal/vault**, **Xavier**, **edge-mesh** (Yjs) y router de LLM en
  `src/lib/` — capa agéntica disponible pero todavía sin consumidor en las
  páginas públicas
- **localStorage** para el resultado de la evaluación (sin cuenta, sin registro)
- **Vitest** para las pruebas

## Capa agéntica

Disponible en `src/lib/`, sin uso en las rutas públicas por ahora:

- **Xavier:** `xavierSearch(query)` / `xavierAdd(content)` → `localhost:8006`
  con fallback a IndexedDB.
- **Mesh:** `meshPublish(topic, payload)` / `meshSubscribe(topic, handler)` →
  Yjs/y-webrtc.
- **LLM:** `llmComplete({prompt, system, useMemory})` → `ProviderRouter`.
- **AUI:** `AuiRenderer.svelte` + `src/lib/aui.ts` (whitelist de componentes).
- **Billing:** `src/lib/billing.ts`, tiers socio/managed con 20 % de handling.

`src/lib/domain.config.ts` es el archivo que conecta el modelo de negocio
(appId + entities) con esa capa.

## Verificación

```bash
pnpm run check   # 0 errores, 0 warnings
pnpm test        # 125 tests
pnpm run test:tokens
pnpm run build
```

Los tres locales responden 200 y el build deja el sitio con el worker de
Cloudflare listo para desplegar. El historial está en `CHANGELOG.md`.

## Licencia

`PISAStyle Public Core License — Uso exclusivo del laboratorio SWAL`
(`LicenseRef-SWAL-PISAStyle-1.0`):

1. El código es visible públicamente como vitrina técnica bajo AGPL-3.0-only.
2. El despliegue en producción bajo `pisa.swal.network`, la marca PISAStyle, los
   contenidos de preguntas y de `study_content`, la lógica de backend y los
   planes internos son **privados** y requieren licencia comercial escrita.
3. PISA es un programa de la OCDE. Este proyecto es contenido educativo no
   oficial.

Texto completo en `LICENSE.md`.

---

 Scaffold base: `@swal/app-template` en `cores/swal-app-template`.
 Design system: `cores/swal-ui`. P2P: `cores/edge-mesh`. LLM: `cores/swal-agent-runner`.
