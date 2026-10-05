/**
 * exam-items — the fifteen items of the self-assessment ("¿en qué nivel estoy?").
 *
 * WHY THIS FILE — EXTRACTION, NOT A REWRITE
 * The fifteen questions used to live inside the `COPY` literal of
 * src/pages/[locale]/evaluar.astro. Every string here was moved verbatim from
 * that literal: not one key, not one option, not one correct index was edited,
 * reworded or re-ordered. The order of `options` is the order the page renders
 * and `correctIndex` points into that very array, so a shuffle in one locale is
 * NOT a reordering bug: the three locales shuffle differently on purpose, which
 * is why `correctIndex` differs per locale for the same question.
 *
 * The three locales translate the SAME fifteen items, so a locale's items line up
 * one-to-one by (domain, index) across `es`, `en` and `pt`.
 *
 * ANSWER KEYS ARE AUDITED CONTENT. The keys were verified against real
 * arithmetic by the repo's own tests and must not be "fixed" by hand here: if an
 * item looks wrong, the correct move is to report it, not to edit it.
 *
 * NO ACCOUNTS, NO USER DATA. This product has no login and no tracking; these
 * fifteen strings are static public content.
 */

/** The three domains of the self-assessment. Presentation order is this order. */
export type ExamDomain = 'math' | 'reading' | 'science';

/** Locales this module carries items for. Mirrors pisa-i18n.PisaLocale. */
export type ExamLocale = 'es' | 'en' | 'pt';

/**
 * `level` is NOT a PISA proficiency level.
 *
 * The page has no per-item level and never had one: what it declares is
 * LEVEL_BY_SCORE, a score-to-level table for the whole domain (0..5 correct ->
 * '1c' | '1b' | '2' | '3' | '4' | '5'). There is nothing in the source data to
 * read a per-item level from, so this field is an honest ESTIMATION: the 1-based
 * position of the item inside its domain (1..5), i.e. "item N of this domain".
 * It exists only so a metadata chip can order the items. ESTIMATE, NOT PISA.
 */
export interface ExamItem {
  /** Stable across locales: `<domain>-<1-based position>`, e.g. `math-3`. */
  id: string;
  domain: ExamDomain;
  /** Domain label in the item's own locale, taken from the source `domains`. */
  domainLabel: string;
  /** 0-based position of the item inside its domain. */
  index: number;
  /** 1-based position inside its domain. Estimation — see the note above. */
  level: number;
  stem: string;
  /** Options in the order they are rendered. */
  options: string[];
  /** Index into `options` of the correct one. Varies per locale by design. */
  correctIndex: number;
  /** '' for every item: the source data has no per-item explanation. */
  explanation: string;
}

/** Domain presentation order and its label in each locale. */
export const EXAM_DOMAINS: {
  key: ExamDomain;
  label: Record<ExamLocale, string>;
}[] = [
  { key: "math", label: { es: "Matemáticas", en: "Mathematics", pt: "Matemática" } },
  { key: "reading", label: { es: "Lectura", en: "Reading", pt: "Leitura" } },
  { key: "science", label: { es: "Ciencias", en: "Science", pt: "Ciências" } },
];

/** The fifteen items per locale, grouped by domain in presentation order. */
export const EXAM_ITEMS: Record<ExamLocale, ExamItem[]> = {
  es: [
  {
    id: "math-1",
    domain: "math",
    domainLabel: "Matemáticas",
    index: 0,
    level: 1,
    stem: "Si 3 paneles cubren 12 m de cerca, ¿cuántos metros cubren 8 paneles?",
    options: ["28 m", "32 m", "24 m", "36 m"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "math-2",
    domain: "math",
    domainLabel: "Matemáticas",
    index: 1,
    level: 2,
    stem: "Una fracción simplifica a 3/4. Multiplicando numerador y denominador por 5, ¿qué obtienes?",
    options: ["3/4", "15/20", "12/20", "3/20"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "math-3",
    domain: "math",
    domainLabel: "Matemáticas",
    index: 2,
    level: 3,
    stem: "Una piscina tarda 4 h en llenarse con un manguo. ¿Con dos mangos iguales?",
    options: ["2 h", "8 h", "3 h", "4 h"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "math-4",
    domain: "math",
    domainLabel: "Matemáticas",
    index: 3,
    level: 4,
    stem: "En un mapa 1 cm representa 50 km. ¿Qué distancia real son 7 cm?",
    options: ["500 km", "150 km", "700 km", "350 km"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "math-5",
    domain: "math",
    domainLabel: "Matemáticas",
    index: 4,
    level: 5,
    stem: "Una clase de 30 tiene 18 niñas. ¿Qué porcentaje son niñas?",
    options: ["70 %", "60 %", "50 %", "80 %"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "reading-1",
    domain: "reading",
    domainLabel: "Lectura",
    index: 0,
    level: 1,
    stem: "Lee: \"El informe señala que la ciudad creció un 12 % en dos años.\" ¿Qué se sigue?",
    options: ["La ciudad perdió 12 %", "No se puede saber", "La ciudad creció 12 % en dos años", "Creció 100 %"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "reading-2",
    domain: "reading",
    domainLabel: "Lectura",
    index: 1,
    level: 2,
    stem: "El texto dice \"a pesar de la lluvia, la feria prosiguió\". La palabra que marca el contraste es:",
    options: ["feria", "la lluvia", "a pesar de", "prosiguió"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "reading-3",
    domain: "reading",
    domainLabel: "Lectura",
    index: 2,
    level: 3,
    stem: "Un texto afirma que el parque \"es un lugar importante\". Con solo eso, ¿puedes afirmar su tamaño?",
    options: ["Solo con un mapa", "Sí, es pequeño", "Sí, es grande", "No, no se sabe"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "reading-4",
    domain: "reading",
    domainLabel: "Lectura",
    index: 3,
    level: 4,
    stem: "En un texto, \"el autor propone\" indica que:",
    options: ["Es una cita textual", "Es un dato comprobado", "Es una opinión o sugerencia", "Es una conclusión automática"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "reading-5",
    domain: "reading",
    domainLabel: "Lectura",
    index: 4,
    level: 5,
    stem: "Lee: \"A pesar del aumento del precio, la demanda bajó.\" Esto es:",
    options: ["Una coincidencia", "Una cita", "Una relación esperada", "Una descripción"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-1",
    domain: "science",
    domainLabel: "Ciencias",
    index: 0,
    level: 1,
    stem: "¿Qué describe mejor el efecto de la sal sobre el hielo?",
    options: ["Lo calienta", "Baja su punto de congelación y lo derrite", "Lo seca", "Lo endurece"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "science-2",
    domain: "science",
    domainLabel: "Ciencias",
    index: 1,
    level: 2,
    stem: "Una planta crece hacia la luz. Ese comportamiento se llama:",
    options: ["Fototropismo", "Hidrotropismo", "Quimiotropismo", "Geotropismo"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "science-3",
    domain: "science",
    domainLabel: "Ciencias",
    index: 2,
    level: 3,
    stem: "Al sumergir un cuerpo en agua, los objetos más densos se hunden porque:",
    options: ["Son más grandes", "Son siempre más pesados", "Tienen más masa", "Su peso supera el empuje"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "science-4",
    domain: "science",
    domainLabel: "Ciencias",
    index: 3,
    level: 4,
    stem: "La energía que mueve un molino de viento es:",
    options: ["Energía nuclear", "Energía química", "Energía cinética", "Energía eléctrica"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-5",
    domain: "science",
    domainLabel: "Ciencias",
    index: 4,
    level: 5,
    stem: "Un ejemplo de cambio físico es:",
    options: ["La comida digiriéndose", "El hierro oxidándose", "El hielo derritiéndose", "La madera ardiendo"],
    correctIndex: 2,
    explanation: "",
  },
  ],
  en: [
  {
    id: "math-1",
    domain: "math",
    domainLabel: "Mathematics",
    index: 0,
    level: 1,
    stem: "If 3 fence panels cover 12 m, how many metres do 8 panels cover?",
    options: ["32 m", "28 m", "24 m", "36 m"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "math-2",
    domain: "math",
    domainLabel: "Mathematics",
    index: 1,
    level: 2,
    stem: "A fraction reduces to 3/4. Multiplying numerator and denominator by 5 gives:",
    options: ["3/20", "3/4", "15/20", "12/20"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "math-3",
    domain: "math",
    domainLabel: "Mathematics",
    index: 2,
    level: 3,
    stem: "A pool takes 4 h to fill with one hose. How long with two identical hoses?",
    options: ["4 h", "2 h", "3 h", "8 h"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "math-4",
    domain: "math",
    domainLabel: "Mathematics",
    index: 3,
    level: 4,
    stem: "On a map 1 cm represents 50 km. What real distance is 7 cm?",
    options: ["350 km", "700 km", "150 km", "500 km"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "math-5",
    domain: "math",
    domainLabel: "Mathematics",
    index: 4,
    level: 5,
    stem: "A class of 30 has 18 girls. What percentage are girls?",
    options: ["60 %", "50 %", "70 %", "80 %"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "reading-1",
    domain: "reading",
    domainLabel: "Reading",
    index: 0,
    level: 1,
    stem: "Read: \"The report notes the city grew 12 % in two years.\" Which statement follows?",
    options: ["The city grew 12 % in two years", "Cannot be known", "The city lost 12 %", "It grew 100 %"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "reading-2",
    domain: "reading",
    domainLabel: "Reading",
    index: 1,
    level: 2,
    stem: "The text says \"despite the rain, the fair went ahead\". The word marking the contrast is:",
    options: ["despite", "went ahead", "fair", "the rain"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "reading-3",
    domain: "reading",
    domainLabel: "Reading",
    index: 2,
    level: 3,
    stem: "A text says the park \"is an important landmark\". Can you tell its size from that alone?",
    options: ["Yes, it is large", "Yes, it is small", "No, unknown", "Only with a map"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "reading-4",
    domain: "reading",
    domainLabel: "Reading",
    index: 3,
    level: 4,
    stem: "In a text, \"the author proposes\" means:",
    options: ["An opinion or suggestion", "A verified fact", "An automatic conclusion", "A quotation"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "reading-5",
    domain: "reading",
    domainLabel: "Reading",
    index: 4,
    level: 5,
    stem: "Read: \"Despite the price rise, demand fell.\" This is:",
    options: ["A quote", "An expected relationship", "A coincidence", "A description"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "science-1",
    domain: "science",
    domainLabel: "Science",
    index: 0,
    level: 1,
    stem: "Which statement best describes the effect of salt on ice?",
    options: ["It warms it", "It dries it", "It lowers the freezing point, melting ice", "It hardens it"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-2",
    domain: "science",
    domainLabel: "Science",
    index: 1,
    level: 2,
    stem: "A plant grows toward light. This behaviour is called:",
    options: ["Chemotropism", "Hydrotropism", "Geotropism", "Phototropism"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "science-3",
    domain: "science",
    domainLabel: "Science",
    index: 2,
    level: 3,
    stem: "In water, denser objects sink because they:",
    options: ["Their weight exceeds the buoyant force", "Are larger", "Are always heavier", "Have more mass"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "science-4",
    domain: "science",
    domainLabel: "Science",
    index: 3,
    level: 4,
    stem: "The energy that drives a windmill is:",
    options: ["Nuclear energy", "Chemical energy", "Kinetic energy", "Electrical energy"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-5",
    domain: "science",
    domainLabel: "Science",
    index: 4,
    level: 5,
    stem: "An example of a physical change is:",
    options: ["Iron rusting", "Food digesting", "Wood burning", "Ice melting"],
    correctIndex: 3,
    explanation: "",
  },
  ],
  pt: [
  {
    id: "math-1",
    domain: "math",
    domainLabel: "Matemática",
    index: 0,
    level: 1,
    stem: "Se 3 painéis cobrem 12 m de cerca, quantos metros cobrem 8 painéis?",
    options: ["36 m", "28 m", "24 m", "32 m"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "math-2",
    domain: "math",
    domainLabel: "Matemática",
    index: 1,
    level: 2,
    stem: "Uma fração simplifica para 3/4. Multiplicando numerador e denominador por 5:",
    options: ["3/20", "15/20", "12/20", "3/4"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "math-3",
    domain: "math",
    domainLabel: "Matemática",
    index: 2,
    level: 3,
    stem: "Uma piscina leva 4 h para encher com uma mangueira. Com duas iguais?",
    options: ["8 h", "3 h", "4 h", "2 h"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "math-4",
    domain: "math",
    domainLabel: "Matemática",
    index: 3,
    level: 4,
    stem: "No mapa 1 cm representa 50 km. Que distância real são 7 cm?",
    options: ["500 km", "350 km", "700 km", "150 km"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "math-5",
    domain: "math",
    domainLabel: "Matemática",
    index: 4,
    level: 5,
    stem: "Uma turma de 30 tem 18 meninas. Que percentual são meninas?",
    options: ["50 %", "80 %", "70 %", "60 %"],
    correctIndex: 3,
    explanation: "",
  },
  {
    id: "reading-1",
    domain: "reading",
    domainLabel: "Leitura",
    index: 0,
    level: 1,
    stem: "Leia: \"O relatório aponta que a cidade cresceu 12 % em dois anos.\" Qual afirmação decorre?",
    options: ["A cidade perdeu 12 %", "A cidade cresceu 12 % em dois anos", "Cresceu 100 %", "Não é possível saber"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "reading-2",
    domain: "reading",
    domainLabel: "Leitura",
    index: 1,
    level: 2,
    stem: "O texto diz \"apesar da chuva, a feira prosseguiu\". A palavra que marca o contraste é:",
    options: ["prosseguiu", "feira", "apesar", "da chuva"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "reading-3",
    domain: "reading",
    domainLabel: "Leitura",
    index: 2,
    level: 3,
    stem: "Um texto diz que o parque \"é um lugar importante\". Só com isso, pode afirmar o tamanho?",
    options: ["Não, não se sabe", "Só com um mapa", "Sim, é grande", "Sim, é pequeno"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "reading-4",
    domain: "reading",
    domainLabel: "Leitura",
    index: 3,
    level: 4,
    stem: "Num texto, \"o autor propõe\" indica que:",
    options: ["É uma citação", "É uma opinião ou sugestão", "É uma conclusão automática", "É um dado comprovado"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "reading-5",
    domain: "reading",
    domainLabel: "Leitura",
    index: 4,
    level: 5,
    stem: "Leia: \"Apesar da alta do preço, a demanda caiu.\" Isto é:",
    options: ["Uma citação", "Uma relação esperada", "Uma descrição", "Uma coincidência"],
    correctIndex: 1,
    explanation: "",
  },
  {
    id: "science-1",
    domain: "science",
    domainLabel: "Ciências",
    index: 0,
    level: 1,
    stem: "Qual afirmação descreve melhor o efeito do sal no gelo?",
    options: ["Baixa o ponto de congelamento e o derrete", "Endurece", "Seca", "Aquece"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "science-2",
    domain: "science",
    domainLabel: "Ciências",
    index: 1,
    level: 2,
    stem: "Uma planta cresce em direção à luz. Esse comportamento chama-se:",
    options: ["Hidrotropismo", "Quimiotropismo", "Fototropismo", "Geotropismo"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-3",
    domain: "science",
    domainLabel: "Ciências",
    index: 2,
    level: 3,
    stem: "Ao submergir um corpo em água, os objetos mais densos afundam porque:",
    options: ["Têm mais massa", "São sempre mais pesados", "O peso supera o empuxo", "São maiores"],
    correctIndex: 2,
    explanation: "",
  },
  {
    id: "science-4",
    domain: "science",
    domainLabel: "Ciências",
    index: 3,
    level: 4,
    stem: "A energia que move um moinho de vento é:",
    options: ["Energia cinética", "Energia química", "Energia nuclear", "Energia elétrica"],
    correctIndex: 0,
    explanation: "",
  },
  {
    id: "science-5",
    domain: "science",
    domainLabel: "Ciências",
    index: 4,
    level: 5,
    stem: "Exemplo de mudança física é:",
    options: ["O gelo derretendo", "O ferro enferrujando", "A comida digerindo", "A madeira queimando"],
    correctIndex: 0,
    explanation: "",
  },
  ],
};

/** Every locale this module serves, in presentation order. */
export const EXAM_LOCALES: ExamLocale[] = ["es", "en", "pt"];

/** Regroup a flat item list by domain, keeping items in their original order. */
export function examByDomain(
  items: ExamItem[],
): Record<ExamDomain, ExamItem[]> {
  const out = { math: [], reading: [], science: [] } as Record<ExamDomain, ExamItem[]>;
  for (const item of items) out[item.domain].push(item);
  return out;
}

/** The label of a domain in a locale, from the source `domains` literals. */
export function domainLabel(domain: ExamDomain, locale: ExamLocale): string {
  const found = EXAM_DOMAINS.find((d) => d.key === domain);
  if (!found) throw new Error(`unknown exam domain: ${domain}`);
  return found.label[locale];
}

/** The text of the correct option — what a result screen shows as the answer. */
export function correctText(item: ExamItem): string {
  return item.options[item.correctIndex];
}

/**
 * Every option that is NOT the correct one, paired with the index it occupies,
 * so callers can show "you picked X, the answer was Y" without re-deriving the
 * index. The correct option is never in the result.
 */
export function distractorTexts(item: ExamItem): { index: number; text: string }[] {
  return item.options
    .map((text, index) => ({ index, text }))
    .filter((o) => o.index !== item.correctIndex);
}
