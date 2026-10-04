/**
 * ContribForm — formulario de propuesta de /contribuir.
 *
 * Por que Svelte y no un form nativo con GET (que es lo que hace evaluar.astro):
 * porque aqui el resultado NO se renderiza en el servidor. La entrega es abrir
 * un enlace de GitHub con el contenido ya escrito, o descargar un .md. Eso
 * necesita estado en el cliente (validar, componer el texto, decidir entre
 * enlace y fichero) y no necesita servidor. Un POST seria inventar un backend
 * que el producto no tiene y que el visitante tendria que autenticar.
 *
 * Sin tracking, sin cookies, sin identificadores. `localStorage` guarda SOLO el
 * borrador que el visitante esta escribiendo, bajo una clave por locale, y se
 * borra al enviar con exito o al pulsar "Borrar el borrador". Nunca sale del
 * navegador: la unica salida es el portapapeles o la descarga del .md.
 */
<script lang="ts">
  import {
    PROTOCOL_FIELDS,
    countMissingProtocolFields,
    downloadFilename,
    emptyDraft,
    firstInvalidField,
    issueBody,
    issueTitle,
    issueUrl,
    issueUrlFits,
    markdownDocument,
    validateDraft,
    type ContribDraft,
    type ContribErrors,
    type ContribField,
    type OptionLabels,
    type ProtocolField,
  } from '../lib/contrib-issue';

  interface Messages {
    required: string;
    optionsMin: string;
    optionsUnexpected: string;
    errorSummaryTitle: string;
    errorSummaryBody: string;
    draftRestored: string;
    tooLong: string;
    urlTooLong: string;
    copied: string;
    copyFailed: string;
    repoLabel: string;
  }

  interface FormCopy {
    formHeading: string;
    typeLegend: string;
    typeCorrection: string;
    typeCorrectionHelp: string;
    typeNew: string;
    typeNewHelp: string;
    unitLabel: string;
    unitHint: string;
    unitPlaceholder: string;
    stemLabel: string;
    stemHint: string;
    stemPlaceholder: string;
    optionsLegend: string;
    optionsHelp: string;
    explanationLabel: string;
    explanationHint: string;
    explanationPlaceholder: string;
    noteLabel: string;
    noteHint: string;
    notePlaceholder: string;
    protocolLegend: string;
    protocolHelp: string;
    fields: Record<ProtocolField, { label: string; hint: string; placeholder: string }>;
    required: string;
    optional: string;
    submit: string;
    download: string;
    clear: string;
  }

  let {
    locale,
    copy,
    messages,
    issueLabels,
    repoLabel,
  }: {
    locale: string;
    copy: FormCopy;
    messages: Messages;
    issueLabels: OptionLabels;
    repoLabel: string;
  } = $props();

  const DRAFT_KEY = `pisastyle.contrib.draft.${locale}`;

  let draft = $state<ContribDraft>(emptyDraft(locale));
  let errors = $state<ContribErrors>({});
  let notice = $state<{ tone: 'info' | 'warn'; text: string } | null>(null);
  let restored = $state(false);
  let submitted = $state(false);

  const missingCount = $derived(countMissingProtocolFields(draft));
  const title = $derived(issueTitle(draft, issueLabels.types));
  const body = $derived(issueBody(draft, issueLabels));
  const url = $derived(issueUrl(title, body));
  const urlOk = $derived(issueUrlFits(url));
  const errorFields = $derived(Object.keys(errors) as ContribField[]);

  /* ── Borrador local ──────────────────────────────────────────────────────
   * Se guarda en localStorage con un debounce corto porque cada pulsacion
   * escribe. Sin identificador de ningun tipo: solo el texto del visitante.
   * `try/catch` porque en modo privado / cookies bloqueadas localStorage lanza,
   * y la pagina debe seguir funcionando sin borrador (no sin formulario). */
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    // Serializa para que el efecto dependa del VALOR del draft, no de su
    // identidad: mutar draft.options[0] no re-despacha si no se lee en/json.
    const payload = draft;
    if (submitted || restored) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        // Nada escrito = nada que guardar. Sin esto, cada visita deja un
        // borrador vacio en el localStorage del visitante.
        if (isBlank(payload)) return;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {
        /* sin persistencia: no es motivo para romper el formulario */
      }
    }, 300);
  });

  $effect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ContribDraft>;
      // Fusión defensiva: una clave corrupta o de otra versión no debe dejar
      // el formulario sin campos y romper la página.
      draft = { ...emptyDraft(locale), ...parsed, locale };
      restored = true;
    } catch {
      /* borrador ilegible: se ignora y se empieza de cero */
    }
  });

  function fieldError(field: ContribField): string | undefined {
    return submitted ? errors[field] : undefined;
  }

  /** El rotulo legible de un campo, para el resumen de errores. */
  function labelFor(field: ContribField): string {
    if (field === 'unit') return copy.unitLabel;
    if (field === 'stem') return copy.stemLabel;
    if (field === 'options') return copy.optionsLegend;
    if (field === 'explanation') return copy.explanationLabel;
    return copy.fields[field as ProtocolField].label;
  }

  /**
   * `aria-describedby` con el hint SIEMPRE, y con el error cuando lo hay.
   * Un lector de pantalla necesita el hint para entender el formato (por ejemplo
   * que `format` vale `mc-single`) y no solo un "obligatorio".
   */
  function describedBy(field: ContribField, hintId: string): string {
    return fieldError(field) ? `${hintId} ${fieldId(field)}-error` : hintId;
  }

  /** El visitante no ha escrito nada todavia: no hay nada que persistir. */
  function isBlank(d: ContribDraft): boolean {
    return !PROTOCOL_FIELDS.some((f) => d[f].trim()) && !d.stem.trim() && !d.unit.trim() && !d.note.trim();
  }

  function set(field: keyof ContribDraft, value: string) {
    draft[field] = value;
  }

  function setOption(index: number, value: string) {
    draft.options[index] = value;
  }

  /** Ancla los ids: el error se anuncia con aria-describedby y role="alert". */
  function fieldId(field: ContribField): string {
    return `c-${field}`;
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    errors = validateDraft(draft, messages);
    submitted = true;

    const first = firstInvalidField(errors);
    if (first) {
      notice = null;
      const el = document.getElementById(fieldId(first));
      if (el instanceof HTMLElement) el.focus();
      return;
    }

    notice = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nada que limpiar, el formulario ya esta completo */
    }

    if (!urlOk) {
      // Un enlace de 12 KB lo rejectan el navegador o el propio GitHub. Decirlo
      // es honesto; fingir que el enlace funciono dejaria al visitante con un
      // boton que no hace nada.
      notice = { tone: 'warn', text: messages.urlTooLong };
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function download() {
    const doc = markdownDocument(draft, issueLabels, title);
    const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = downloadFilename(draft);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // revoke inmediato con un tick de margen: en Safari, revocar en el mismo
    // tick cancela la descarga antes de que arranque.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    notice = { tone: 'info', text: messages.tooLong };
  }

  function clearDraft() {
    draft = emptyDraft(locale);
    errors = {};
    submitted = false;
    restored = false;
    notice = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nada guardado */
    }
  }
</script>

<form class="form" onsubmit={handleSubmit} novalidate aria-labelledby="c-form-heading">
  <!-- El titulo visible vive en la pagina (.astro) y este es el ancla para el
     formulario: sin un nombre accesible, un lector de pantalla anuncia
     "formulario" sin decir de que formulario se trata. -->
  <h2 id="c-form-heading">{copy.formHeading}</h2>

  <!-- Resumen de errores. role="alert" + focus al primer campo: es lo que
      permite a un lector de pantalla saber que fallo sin cazar el campo. -->
  {#if submitted && errorFields.length > 0}
    <div class="summary" role="alert" tabindex="-1" id="c-summary">
      <p class="summary-title">{messages.errorSummaryTitle}</p>
      <p>{messages.errorSummaryBody}</p>
      <ul>
        {#each errorFields as f (f)}
          <li><a href={`#${fieldId(f)}`}>{labelFor(f)}</a></li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if restored && !notice}
    <p class="notice notice-info" role="status">{messages.draftRestored}</p>
  {/if}

  {#if notice}
    <p class="notice" class:notice-warn={notice.tone === 'warn'} role="status">{notice.text}</p>
  {/if}

  <fieldset class="block">
    <legend>{copy.typeLegend}</legend>
    <div class="choices">
      <label class="choice">
        <input type="radio" name="type" value="correction" bind:group={draft.type} />
        <span>
          <strong>{copy.typeCorrection}</strong>
          <small>{copy.typeCorrectionHelp}</small>
        </span>
      </label>
      <label class="choice">
        <input type="radio" name="type" value="new" bind:group={draft.type} />
        <span>
          <strong>{copy.typeNew}</strong>
          <small>{copy.typeNewHelp}</small>
        </span>
      </label>
    </div>
  </fieldset>

  {#if draft.type === 'correction'}
    <div class="field">
      <label for="c-unit">{copy.unitLabel} <span class="req">{copy.required}</span></label>
      <p class="hint" id="c-unit-hint">{copy.unitHint}</p>
      <input
        id="c-unit"
        name="unit"
        type="text"
        placeholder={copy.unitPlaceholder}
        value={draft.unit}
        oninput={(e) => set('unit', e.currentTarget.value)}
        aria-invalid={fieldError('unit') ? 'true' : undefined}
        aria-describedby={describedBy('unit', 'c-unit-hint')}
        required
      />
      {#if fieldError('unit')}<p class="error" id="c-unit-error" role="alert">{fieldError('unit')}</p>{/if}
    </div>
  {/if}

  <div class="field">
    <label for="c-stem">{copy.stemLabel} <span class="req">{copy.required}</span></label>
    <p class="hint" id="c-stem-hint">{copy.stemHint}</p>
    <textarea
      id="c-stem"
      name="stem"
      rows="3"
      placeholder={copy.stemPlaceholder}
      value={draft.stem}
      oninput={(e) => set('stem', e.currentTarget.value)}
      aria-invalid={fieldError('stem') ? 'true' : undefined}
      aria-describedby={describedBy('stem', 'c-stem-hint')}
      required
    ></textarea>
    {#if fieldError('stem')}<p class="error" id="c-stem-error" role="alert">{fieldError('stem')}</p>{/if}
  </div>

  <fieldset class="block">
    <legend>{copy.optionsLegend}</legend>
    <p class="hint" id="c-options-hint">{copy.optionsHelp}</p>
    <div class="options" role="group" aria-describedby="c-options-hint">
      {#each draft.options as option, i (i)}
        <div class="option-row">
          <label class="option-key" for={`c-option-${i}`}>{String.fromCharCode(65 + i)}</label>
          <input
            id={`c-option-${i}`}
            name={`option-${i}`}
            type="text"
            value={option}
            oninput={(e) => setOption(i, e.currentTarget.value)}
          />
        </div>
      {/each}
    </div>
    {#if fieldError('options')}
      <p class="error" id="c-options-error" role="alert">{fieldError('options')}</p>
    {/if}
  </fieldset>

  <div class="field">
    <label for="c-explanation">{copy.explanationLabel} <span class="req">{copy.required}</span></label>
    <p class="hint" id="c-explanation-hint">{copy.explanationHint}</p>
    <textarea
      id="c-explanation"
      name="explanation"
      rows="3"
      placeholder={copy.explanationPlaceholder}
      value={draft.explanation}
      oninput={(e) => set('explanation', e.currentTarget.value)}
      aria-invalid={fieldError('explanation') ? 'true' : undefined}
      aria-describedby={describedBy('explanation', 'c-explanation-hint')}
      required
    ></textarea>
    {#if fieldError('explanation')}<p class="error" id="c-explanation-error" role="alert">{fieldError('explanation')}</p>{/if}
  </div>

  <fieldset class="block">
    <legend>{copy.protocolLegend}</legend>
    <p class="hint" id="c-protocol-hint">{copy.protocolHelp}</p>
    <div class="grid">
      {#each PROTOCOL_FIELDS as field (field)}
        <div class="field">
          <label for={fieldId(field)}>
            {copy.fields[field].label} <span class="req">{copy.required}</span>
          </label>
          <p class="hint" id={`${fieldId(field)}-hint`}>{copy.fields[field].hint}</p>
          <input
            id={fieldId(field)}
            name={field}
            type="text"
            placeholder={copy.fields[field].placeholder}
            value={draft[field]}
            oninput={(e) => set(field, e.currentTarget.value)}
            aria-invalid={fieldError(field) ? 'true' : undefined}
            aria-describedby={describedBy(field, `${fieldId(field)}-hint`)}
            required
          />
          {#if fieldError(field)}
            <p class="error" id={`${fieldId(field)}-error`} role="alert">{fieldError(field)}</p>
          {/if}
        </div>
      {/each}
    </div>
    <p class="counter" aria-live="polite">
      {missingCount === 0 ? copy.protocolHelp : `${missingCount} / 8`}
    </p>
  </fieldset>

  <div class="field">
    <label for="c-note">{copy.noteLabel} <span class="opt">{copy.optional}</span></label>
    <p class="hint" id="c-note-hint">{copy.noteHint}</p>
    <textarea
      id="c-note"
      name="note"
      rows="2"
      placeholder={copy.notePlaceholder}
      value={draft.note}
      oninput={(e) => set('note', e.currentTarget.value)}
      aria-describedby="c-note-hint"
    ></textarea>
  </div>

  <div class="actions">
    <button type="submit" class="btn-primary">
      {copy.submit}
      <span class="repo-hint">{messages.repoLabel} {repoLabel}</span>
    </button>
    <button type="button" class="btn-secondary" onclick={download}>{copy.download}</button>
    <button type="button" class="btn-ghost" onclick={clearDraft}>{copy.clear}</button>
  </div>
</form>

<style>
  .form { display: flex; flex-direction: column; gap: 1.5rem; }
  .form > h2 { font-size: 1.15rem; font-weight: 700; color: var(--swal-text); margin: 0; }
  .block { border: 1px solid var(--swal-border); border-radius: var(--swal-radius-md, 8px); padding: 1rem 1.1rem; margin: 0; }
  legend { font-weight: 700; color: var(--swal-text); padding: 0 0.35rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  label { font-weight: 600; color: var(--swal-text); font-size: 0.9rem; }
  .req { font-weight: 500; font-size: 0.75rem; color: var(--swal-text-secondary); }
  .opt { font-weight: 500; font-size: 0.75rem; color: var(--swal-text-muted); }
  .hint { font-size: 0.8rem; color: var(--swal-text-secondary); margin: 0; line-height: 1.45; }
  input[type='text'], textarea {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--swal-border);
    border-radius: var(--swal-radius-sm, 6px);
    background: var(--swal-surface);
    color: var(--swal-text);
    font-family: inherit;
    font-size: 0.95rem;
  }
  textarea { resize: vertical; }
  /* Foco visible en TODO control: el foco por defecto se pierde sobre el
     fondo oscuro y el sitio entero navega con teclado. */
  input:focus-visible, textarea:focus-visible, button:focus-visible, .summary:focus-visible, a:focus-visible {
    outline: 2px solid var(--pisa-focus, var(--swal-accent));
    outline-offset: 2px;
  }
  [aria-invalid='true'] { border-color: var(--pisa-incorrect, #D55E00); }
  .error { color: var(--swal-text); font-size: 0.82rem; margin: 0.1rem 0 0; font-weight: 600; }
  /* El icono no es decorativo: WCAG 1.4.1 forbids color as the only cue. */
  .error::before { content: '⚠ '; color: var(--pisa-incorrect, #D55E00); }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .choices { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .choice { display: flex; gap: 0.6rem; align-items: flex-start; font-weight: 400; cursor: pointer; padding: 0.5rem; border-radius: 6px; }
  .choice:hover { background: var(--swal-surface-hover); }
  .choice span { display: flex; flex-direction: column; gap: 0.15rem; }
  .choice small { color: var(--swal-text-secondary); font-size: 0.8rem; line-height: 1.4; }
  .options { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.6rem; }
  .option-row { display: flex; align-items: center; gap: 0.6rem; }
  .option-key {
    flex: 0 0 1.75rem; min-height: 2.25rem; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--swal-border); border-radius: 6px; font-size: 0.8rem; color: var(--swal-text-secondary);
  }
  .counter { font-size: 0.8rem; color: var(--swal-text-secondary); margin: 0.6rem 0 0; }
  .summary {
    border: 1px solid var(--pisa-incorrect, #D55E00); border-left-width: 4px;
    border-radius: 6px; padding: 0.9rem 1rem; background: var(--swal-surface);
  }
  .summary p { margin: 0 0 0.4rem; font-size: 0.88rem; color: var(--swal-text); }
  .summary-title { font-weight: 700; }
  .summary ul { margin: 0.2rem 0 0; padding-left: 1.2rem; font-size: 0.85rem; }
  .summary a { color: var(--swal-text); }
  .notice {
    border: 1px solid var(--swal-border); border-left: 4px solid var(--swal-accent);
    border-radius: 6px; padding: 0.7rem 0.9rem; font-size: 0.88rem; color: var(--swal-text);
  }
  .notice-warn { border-left-color: var(--pisa-partial, #E69F00); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
  button { font-family: inherit; cursor: pointer; border-radius: var(--swal-radius-sm, 6px); font-size: 0.95rem; }
  .btn-primary {
    display: inline-flex; flex-direction: column; align-items: flex-start; gap: 0.1rem;
    padding: 0.6rem 1rem; border: 1px solid transparent;
    background: var(--swal-accent); color: var(--swal-accent-contrast, var(--swal-bg)); font-weight: 600;
    min-height: 2.75rem;
  }
  .repo-hint { font-weight: 400; font-size: 0.72rem; opacity: 0.9; }
  .btn-secondary { padding: 0.6rem 1rem; border: 1px solid var(--swal-border); background: var(--swal-surface); color: var(--swal-text); min-height: 2.75rem; }
  .btn-secondary:hover, .btn-ghost:hover { background: var(--swal-surface-hover); }
  .btn-ghost { padding: 0.6rem 0.8rem; border: 1px solid transparent; background: transparent; color: var(--swal-text-secondary); min-height: 2.75rem; }
</style>
