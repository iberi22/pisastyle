# Protocolo PISAStyle v1.1 (público)

Método del laboratorio SWAL para estudiar y evaluar estilo PISA.
Contenido educativo NO OFICIAL, sin afiliación con la OECD.
Anclaje: OECD PISA 2022 Mathematics Framework, PISA 2018 Reading Framework,
PISA 2025 Science Framework (2nd draft), PISA 2025 LDW Framework (2nd draft).

## 1. Unidad = átomo (estímulo + estudio + ítems)

Todo ítem vive en una unidad con estímulo común (texto/tabla/gráfico/simulación)
+ 3-6 ítems encadenados de dificultad creciente; el último ítem, el de nivel
más alto (patrón Forested Areas / Greenhouse). Cada unidad trae su
`study_content` inseparable: material rico de 60-120 min que SUSTENTA las
preguntas (teoría, ejemplos resueltos, errores típicos, mini-infografías).
Sin study_content no hay examen. Al final SIEMPRE: fuentes (OECD primero),
protocolo usado con versión, y metadatos (dominio, proceso, contenido,
contexto, nivel, demanda, tiempo).

## 2. Etiquetado obligatorio por ítem (8 campos)

`{dominio, proceso, contenido, contexto, formato, demanda, nivel, ancla}`.
Sin etiqueta completa no entra al banco.

| Dominio | Procesos / competencias | Contenido | Contexto |
|---------|-------------------------|-----------|----------|
| Matemáticas (2022) | razonamiento ~25, formular ~25, emplear ~25, interpretar ~25 | change, space, quantity, uncertainty ~25 c/u | personal, ocupacional, societal, científico |
| Lectura (2018) | localizar 25 (15+10), comprender 45 (15+15+15), evaluar 30 (20+10); único ~65 / múltiple ~35 | descripción, narración, exposición, argumentación, instrucción, transacción | personal, pública, educativa, ocupacional |
| Ciencias (2025 focal) | explicar C1 36-44, diseñar-interpretar C2 24-36, investigar-usar C3 24-36 | contenido 38-48 / procedimental 27-33 / epistémico 24-30; físico 37 / vivo 37 / tierra-espacio 26; regla 3:2 | personal:local/global ≈ 1:2:1 |
| LDW (2025 innovador) | prácticas computacionales + autorregulación; fases Show→Learn→Apply→Reflect | bloques, mapas, flowcharts, simulaciones | digital/escolar |

Demanda cognitiva por ítem: low/med/high (Bloom × Webb). La dificultad
empírica ≠ demanda: un recall oscuro no es "alto".

## 3. Niveles y cortes (escala OECD)

- Matemáticas: 1c 233, 1b 295, 1a 358, 2 420 (base), 3 482, 4 545, 5 607, 6 669.
- Lectura: 1c 189, 1b 262, 1a 335, 2 407 (base), 3 480, 4 553, 5 626, 6 698.
- Ciencias: 1b 261, 1a 335, 2 410 (base), 3 484, 4 559, 5 633, 6 708.
- Regla nivel bajo (1b/1c): contexto cotidiano, 1 paso, oraciones cortas sin
  subordinadas, sin vocabulario técnico, sin carga lectora parásita.

## 4. Formatos y scoring

MC simple (dicotómica), MC compleja (multi-parte, dicotómica a nivel ítem),
construida cerrada (auto: número/exacto), construida abierta con rúbrica
2/1/0 y códigos de no-crédito diferenciados. En razonamiento/argumentación
el crédito parcial es OBLIGATORIO, no opcional.

## 5. Anclas de calibración (ítems liberados OECD)

Mat: Solar System, Triangular Pattern, Forested Areas. Lec: Chicken Forum,
Rapa Nui, Cow's Milk. Cie: Greenhouse (6 ítems), Smoking, Running in Hot
Weather. LDW: Conservation, Recycling Claw, Karel. Hub: OECD PISA Test.

## 6. LDW como capa transversal

Toda unidad digital incluye botón test/feedback, ejemplo trabajado
consultable, log de eventos (tiempo, ejecuciones, ayudas, ediciones),
rúbrica parcial por sub-metas y self-report de monitoreo.

## 7. Datos Colombia de referencia (PISA 2022)

Matemáticas 383, lectura 409, ciencias 411. Puesto 64/81.
Promedio OCDE: 472/476/485. Fuente: OECD PISA 2022 Results Vol I + MEN.

## 8. Locales Fase 1

es, en, pt. El estímulo se mantiene fiel; ejemplos/moneda/ciudades se
localizan. Traducir un ítem de lectura cambia su dificultad: toda traducción
se recalibra, nunca es traducción libre.

## 9. Versión

v1.1. Cada unidad declara su `protocol_version`.
