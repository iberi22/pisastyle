# PISAStyle — Telemetría anonimizada (esquema público)

Solo con opt-in explícito, a cambio de tokens SWAL. Sin PII. Sin enunciados.

## Campos PERMITIDOS por evento

| Campo | Ejemplo | Por qué vale |
|-------|---------|--------------|
| event_type | unit_started, item_answered, unit_finished, infographic_view | funnel de aprendizaje |
| unit_id | PISA-MAT-001 | qué contenido funciona |
| domain/process/content/context/level | math/formulate/quantity/personal/3 | diagnóstico por proceso (el tablero dice dónde falla, no solo nota) |
| correct (0/0.5/1) | 1 | calibración de dificultad |
| duration_ms (redondeado a 5s) | 45000 | carga cognitiva, nunca timing exacto anti-fingerprint |
| locale | es | calidad por idioma |
| country_hint (ISO, de CF-IPCountry) | CO | agregados geográficos gruesos, nunca ciudad/GPS |
| device_class | mobile/desktop | optimización esqueleto |
| app_version | 1.0.0 | regresiones |
| instance_ref (hash rotativo diario) | sha256(instanceId+fecha)[:16] | sesiones sin identidad estable |
| consent_version | v1 | auditoría |

## Campos PROHIBIDOS (nunca salen del dispositivo)

Nombre, email, IP, GPS/ciudad fina, enunciados/respuestas literales,
voice/face, claves, wallet. El instanceId estable NUNCA viaja: viaja su hash
rotativo diario. Agregación mínima k=10 antes de vender cualquier dataset.

## Dónde vive la lógica

- Repo público: SOLO este esquema + player que emite eventos al bus local.
- Backend central (privado, edge-hive + Xavier ns `app/pisastyle/instance/{hash}`):
  agregación, ledger de tokens, mercado de datasets anonimizados para nodos/clientes.
- Flujo: app → buffer local cifrado → mesh room `swal/pisastyle/{hash}` →
  edge-hive agrega (k-anonimato) → Xavier guarda agregados → nodo liquida tokens.

## Derechos

Opt-out total en un tap (borra buffer local + deja de emitir). Retención de
agregados 12 meses. Ley colombiana 1581 + GDPR: base = consentimiento.
