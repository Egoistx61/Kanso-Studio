export interface SavedCodeFile {
  id: string;
  name: string;
  languageId: string;
  code: string;
  updatedAt: number;
}

const STORAGE_KEY = 'kanso-saved-files';

export function loadSavedFiles(): SavedCodeFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedFiles(files: SavedCodeFile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // Storage quota ignored
  }
}
