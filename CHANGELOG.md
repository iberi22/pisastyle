# Changelog

Todas las novedades de PISAStyle.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

Sin publicar todavía. Lo que hay debajo es el trabajo en `main`, todavia sin
release: `pnpm run check` y `pnpm run build` en verde, pero sin desplegar.

### Añadido

- **Autoevaluación de nivel** (`/[locale]/evaluar`) en español, inglés y
  portugués: 10 preguntas orientativas (5 por dominio) que devuelven el nivel de
  desempeño más cercano. Es orientativa, no un examen PISA, y la página lo dice.
- **Persistencia del resultado** en `localStorage`, por locale. Al volver sin
  resultados en la URL se repone un aviso con la última estimación y su fecha.
  Solo se guarda el agregado (nivel y aciertos por dominio): nunca las
  respuestas ni los enunciados, que son contenido privado.
- **Navegación global** (`src/components/SiteNav.astro`) en las cuatro rutas
  públicas: destinos, selector ES/EN/PT que conserva la ruta y marca el enlace
  activo con `aria-current`.
- **Infografía `ranking-bars`** en `/[locale]/explorar`: barras horizontales de
  PISA 2022 (Colombia, promedio OCDE, Singapur) por dominio, con eje desde cero,
  leyenda, tabla de datos en `<details>` y la fuente OECD citada al pie.
- **Hero con llamadas a la acción** en la landing, con el evaluador como acción
  principal. Los destinos se resuelven en `src/lib/landing.ts`.
- **Contenido de unidades en español** (`sample-math-es.json`), leído del vault
  privado. Con esto las tres locales muestran unidad.

### Corregido

- **`/es`, `/en` y `/pt` mostraban "Unidad no disponible"** siempre.
  `explorar.astro` leía un `import.meta.glob` de ficheros que nunca se
  crearon. Ahora las unidades se resuelven desde el vault privado
  (`src/lib/units.ts`), con build-time glob porque el SSR corre en workerd y no
  tiene sistema de ficheros.
- **`/metodo` devolvía 500 en las tres locales** por `export const prerender`
  con el adaptador de Cloudflare.
- **workerd no resolvía `@swal/ui`** y cortaba el render a mitad, dejando
  respuestas de 4.929 bytes sin estilos.
- **Los componentes Svelte del core salían sin estilo**: el CSS se genera una
  vez y se importa desde el core, no a mano en cada componente.
- **`lang` y `hreflang` incorrectos** en español y portugués; la raíz y el
  índice ahora abren donde hay contenido, en el idioma pedido.
- **Las etiquetas Math/Reading/Science estaban en inglés** en las páginas en
  español y portugués.
- **El dev server servía por HTTP el material privado** del repositorio.
- **Los CTA apuntaban a `/study` y `/rankings`**, rutas que no existen, y eran
  `<Button>` sin `href`: ni siquiera enlaces. Ahora son `<a>` con destino real.
- **La persistencia de la evaluación estaba muerta en runtime**: un
  `ReferenceError` en la línea de la fecha abortaba el script antes de reponer el
  aviso. El guardado funcionaba, la reposición no.
- **`"Nivel3"` sin espacio** en los badges y los ítems sin tarjeta propia.
- **Los `process` del vault se mostraban en crudo** ("interpret", "apply") en
  lugar de la traducción del locale.

### Seguridad

- El material privado (planes, unidades con rúbrica, adaptadores) sale del
  repositorio y se sirve desde un vault externo; `scripts/private-material.sh`
  documenta por qué y cómo.
- El contenido de preguntas y `study_content` no se versiona: `LICENSE.md`
  punto 2 los declara privados.

## [0.1.0] — sin publicar

Versión inicial del scaffold. Sin tag: `git tag` está vacío.
