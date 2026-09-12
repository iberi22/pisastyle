export interface BoardEntry {
  id: string;
  alias: string;
  score: number;
  date: number;
  unitId?: string;
}

export interface BoardData {
  optIn: boolean;
  entries: BoardEntry[];
}

export const BOARD_LOCAL_KEY = 'pisastyle_board_local';

export interface BoardTranslations {
  title: string;
  optInText: string;
  disclaimer: string;
}

export const BOARD_LOCAL_STRINGS_ES: BoardTranslations = {
  title: 'Tablero Local',
  optInText: 'Aceptar guardar resultados localmente',
  disclaimer: 'Resultados locales. Cifras referencia PISA 2022: Matemáticas COL 383 (puesto 64/81), OCDE 472, SGP 575. Lectura COL 409, OCDE 476, SGP 543. Ciencias COL 411, OCDE 485, SGP 561.'
};

export const BOARD_LOCAL_STRINGS_EN: BoardTranslations = {
  title: 'Local Leaderboard',
  optInText: 'Opt-in to save results locally',
  disclaimer: 'Local results. PISA 2022 reference: Math COL 383 (rank 64/81), OECD 472, SGP 575. Reading COL 409, OECD 476, SGP 543. Science COL 411, OECD 485, SGP 561.'
};

export const BOARD_LOCAL_STRINGS_PT: BoardTranslations = {
  title: 'Tabela de Líderes Local',
  optInText: 'Aceitar salvar os resultados localmente',
  disclaimer: 'Resultados locais. Referência PISA 2022: Matemática COL 383 (posição 64/81), OCDE 472, SGP 575. Leitura COL 409, OCDE 476, SGP 543. Ciências COL 411, OCDE 485, SGP 561.'
};

export function createEntry(alias: string, score: number, unitId?: string, dateOverride?: number): BoardEntry {
  return {
    id: Math.random().toString(36).substring(2, 10),
    alias,
    score,
    date: dateOverride ?? Date.now(),
    ...(unitId ? { unitId } : {})
  };
}

export function addEntry(entries: BoardEntry[], newEntry: BoardEntry, maxEntries: number = 100): BoardEntry[] {
  const updated = [...entries, newEntry];
  // Sort by score descending, then by date descending
  updated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.date - a.date;
  });
  return updated.slice(0, maxEntries);
}

export function getLocalBoard(): BoardData {
  if (typeof window === 'undefined') {
    return { optIn: false, entries: [] };
  }
  try {
    const data = localStorage.getItem(BOARD_LOCAL_KEY);
    if (!data) return { optIn: false, entries: [] };
    const parsed = JSON.parse(data);
    return {
      optIn: Boolean(parsed?.optIn),
      entries: Array.isArray(parsed?.entries) ? parsed.entries : []
    };
  } catch (e) {
    return { optIn: false, entries: [] };
  }
}

export function saveLocalBoard(data: BoardData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOARD_LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    // Ignore errors from localStorage
  }
}

export function optInLocalBoard(): BoardData {
  const data = getLocalBoard();
  data.optIn = true;
  saveLocalBoard(data);
  return data;
}

export function optOutLocalBoard(): BoardData {
  const data = { optIn: false, entries: [] };
  saveLocalBoard(data);
  return data;
}

export function saveEntryLocal(alias: string, score: number, unitId?: string): BoardData {
  const data = getLocalBoard();
  if (!data.optIn) return data;
  const entry = createEntry(alias, score, unitId);
  data.entries = addEntry(data.entries, entry);
  saveLocalBoard(data);
  return data;
}

export function clearLocalBoard(): BoardData {
  const data = getLocalBoard();
  data.entries = [];
  saveLocalBoard(data);
  return data;
}
