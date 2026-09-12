export interface StudyProgress {
  completedItems: string[];
  score?: number;
  lastAccessed: number;
}

const getStorageKey = (unitId: string) => `pisastyle:progress:${unitId}`;

export const getProgress = (storage: Storage, unitId: string): StudyProgress | null => {
  const data = storage.getItem(getStorageKey(unitId));
  if (!data) return null;

  try {
    return JSON.parse(data) as StudyProgress;
  } catch {
    return null;
  }
};

export const saveProgress = (
  storage: Storage,
  unitId: string,
  progress: StudyProgress
): void => {
  storage.setItem(getStorageKey(unitId), JSON.stringify(progress));
};

export const updateProgress = (
  storage: Storage,
  unitId: string,
  updates: Partial<StudyProgress>
): StudyProgress => {
  const current = getProgress(storage, unitId) || {
    completedItems: [],
    lastAccessed: Date.now()
  };

  const updated = { ...current, ...updates, lastAccessed: Date.now() };
  saveProgress(storage, unitId, updated);

  return updated;
};

export const clearProgress = (storage: Storage, unitId: string): void => {
  storage.removeItem(getStorageKey(unitId));
};
