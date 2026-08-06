const RECOVERY_DB = "the-grimoire-recovery";
const RECOVERY_STORE = "snapshots";
const RECOVERY_KEY = "latest";
const CURRENT_KEY = "current";

export type StorageUpdates = Record<string, string>;
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function openRecoveryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RECOVERY_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open recovery database."));
  });
}

export async function saveRecoverySnapshot(snapshot: StorageUpdates): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openRecoveryDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE, "readwrite");
    tx.objectStore(RECOVERY_STORE).put({ savedAt: new Date().toISOString(), snapshot }, RECOVERY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save recovery snapshot."));
  });
  db.close();
}

export async function loadRecoverySnapshot(): Promise<StorageUpdates | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openRecoveryDatabase();
  const value = await new Promise<{ snapshot?: StorageUpdates } | undefined>((resolve, reject) => {
    const request = db.transaction(RECOVERY_STORE, "readonly").objectStore(RECOVERY_STORE).get(RECOVERY_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read recovery snapshot."));
  });
  db.close();
  return value?.snapshot ?? null;
}

async function mergeCurrentMirror(updates: StorageUpdates): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openRecoveryDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE, "readwrite");
    const store = tx.objectStore(RECOVERY_STORE);
    const request = store.get(CURRENT_KEY);
    request.onsuccess = () => {
      const current = (request.result as StorageUpdates | undefined) ?? {};
      store.put({ ...current, ...updates }, CURRENT_KEY);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not update IndexedDB mirror."));
  });
  db.close();
}

/** Apply a group of localStorage writes with rollback and an IndexedDB recovery copy. */
export function commitStorageUpdates(storage: StorageLike, updates: StorageUpdates): void {
  const previous = Object.fromEntries(Object.keys(updates).map(key => [key, storage.getItem(key)]));
  void saveRecoverySnapshot(
    Object.fromEntries(Object.entries(previous).filter((entry): entry is [string, string] => entry[1] !== null)),
  ).catch(error => console.warn("Could not save IndexedDB recovery snapshot.", error));

  try {
    for (const [key, value] of Object.entries(updates)) storage.setItem(key, value);
    void mergeCurrentMirror(updates).catch(error => console.warn("Could not update IndexedDB mirror.", error));
  } catch (error) {
    for (const [key, value] of Object.entries(previous)) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("Storage is full. Export a backup and remove large images before trying again.", { cause: error });
    }
    throw error;
  }
}
