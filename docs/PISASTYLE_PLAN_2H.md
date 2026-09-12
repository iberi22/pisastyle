# Plan PISAStyle 1.0 — fases y detalles (2h sprint producción)

Dominio: pisa.swal.network. Locales Fase 1: es, en, pt. Licencia: core público
AGPL + uso exclusivo laboratorio (LICENSE.md). Preguntas/backend/planes: privados.

## F0 — Scaffold + repo público (30 min) [EN CURSO]
- apps/pisastyle desde cores/swal-app-template (HECHO).
- domain.config con 5 entidades PISA (HECHO). pisa-i18n es/en/pt (HECHO).
- middleware locale sin imponer por IP (HECHO). astro site pisa.swal.network (HECHO).
- PENDIENTE: sanitizar wrangler IDs, astro check + build verde, crear repo
  iberi22/pisastyle público, push solo archivos públicos, DNS pisa.swal.network → Worker.
- Dueño: local. Jules: no.

## F1 — Skill infografías + 5 piloto (25 min)
- Skill pisastyle-infographics (STAGED, pendiente /skills pending en sesión principal).
- 5 componentes: ranking-bars, trend-line, modelling-cycle, proficiency-pyramid,
  pisa2025-whats-new — cada uno ES/EN/PT + tabla accesible + print CSS.
- Verify: Playwright 1280+390, consola 0, astro check 0.
- Dueño: 1 local (componentes) + Jules-A (2 componentes en paralelo).

## F2 — Protocolo v1.0 + validador + 10 unidades (30 min)
- Protocolo público congelado (docs/PISASTYLE_PROTOCOL_v1.md HECHO, afinar con
  brief OECD del subagente-0 al llegar).
- validate_pisa.js privado: frontmatter (unit_id, domain, process, content,
  context, level, locale, protocol_version, study_minutes 60-120, sources>=3)
  + rúbrica con crédito parcial + conteo items 3-6 por estímulo.
- 10 unidades privadas (3 mat, 3 lec, 3 cie, 1 LDW) con study_content 1-2h.
- Dueño: Jules-A (6 unidades) + Jules-B (4 unidades) en paralelo, issues canónicas.

## F3 — Player examen + estudio (20 min)
- Página unidad: estímulo fijo lateral + ítems + estudio previo obligatorio +
  fuentes + metadatos protocolo desplegables. Intento hasheado (score-hash).
- Dueño: local (player) + Jules (tests).

## F4 — Área info/rankings i18n (15 min)
- /es|en|pt/pisa/, /rankings/, /infografias/ con hreflang, hero Colombia 383/409/411.
- Dueño: local.

## F5 — Telemetría + nodo tokens (10 min)
- Esquema público (HECHO docs/PISASTYLE_TELEMETRY.md). Adapter privado en
  edge-hive + ledger. Auditoría con brief del subagente-2 al llegar.
- Dueño: local (adapter) — NO en repo público.

## F6 — Mesh ready + producción (10 min)
- xavier ns app/pisastyle/instance/{hash}, mesh room swal/pisastyle/{id},
  billing payg, e2e PASS, deploy pisa.swal.network, smoke.
- Dueño: local.

## Orquestación 2 cuentas Jules + local
- Cuenta-1 (JULES_API_KEY): contenido F2 lote A + infografías lote A.
- Cuenta-2 (JULES_API_KEY_2): contenido F2 lote B + tests F3.
- Local (opencode-go deepseek-v4-pro + flash): scaffold, player, i18n, verify, merges.
- Issues canónicas feat- + 11 secciones a iberi22/pisastyle con label jules.
- Kanban: BLOQUEADO desde este contexto (hermes kanban rechaza child contexts).
  Crear board/tareas desde sesión principal con: hermes kanban boards switch pisastyle
  (ya creado el board) + hermes kanban create ... (8 tareas = F0-F7 del todo_list).
