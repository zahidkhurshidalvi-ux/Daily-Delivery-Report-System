// Safe Storage utility with fallback in-memory dictionary
// Prevents DOMException SecurityError in third-party iframes and QuotaExceededError

const memoryStore = new Map<string, string>();

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasStorage = isStorageAvailable();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (hasStorage && typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Ignore security errors in iframes
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    // Always keep memory store updated as immediate fallback
    memoryStore.set(key, value);
    try {
      if (hasStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Gracefully silent in iframes or quota exceeded
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);
    try {
      if (hasStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  },

  clear(): void {
    memoryStore.clear();
    try {
      if (hasStorage && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {
      // Ignore
    }
  },
};
