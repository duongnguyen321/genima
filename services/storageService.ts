import { Session } from '../types';

const DB_NAME = 'FlashEditorDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
};

export const getAllSessionsFromDB = async (): Promise<Session[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get sessions from DB:", error);
    return [];
  }
};

export const saveSessionToDB = async (session: Session): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to save session to DB:", error);
  }
};

export const deleteSessionFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to delete session from DB:", error);
  }
};

export const clearLocalStorageAndMigrate = async (): Promise<Session[] | null> => {
    const saved = localStorage.getItem('flash_editor_sessions');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                console.log("Migrating sessions from LocalStorage to IndexedDB...");
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                
                // Use a promise to wait for all puts to complete
                const putPromises = parsed.map(session => {
                    return new Promise<void>((resolve, reject) => {
                        const req = store.put(session);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                });

                await Promise.all(putPromises);
                
                // Clear local storage to free up space immediately
                localStorage.removeItem('flash_editor_sessions');
                console.log("Migration complete.");
                return parsed;
            }
        } catch (e) {
            console.error("Migration failed", e);
        }
    }
    return null;
};