export const CANVAS_DB_NAME = 'DojoOS_Canvas';
export const CANVAS_STORE_NAME = 'canvas_docs';
export const CANVAS_DB_VERSION = 1;

export interface OfflineCanvasDoc {
  id: string;             // Topic ID
  content: string;        // JSON string of CanvasData
  name: string;
  updatedAt: number;      // local timestamp (ms)
}

export const canvasOfflineStorage = {

  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CANVAS_DB_NAME, CANVAS_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CANVAS_STORE_NAME)) {
          db.createObjectStore(CANVAS_STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  },

  async saveDoc(
    id: string,
    content: string,
    name: string,
  ): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CANVAS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CANVAS_STORE_NAME);

      const doc: OfflineCanvasDoc = {
        id,
        content,
        name,
        updatedAt: Date.now(),
      };

      const request = store.put(doc);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async loadDoc(id: string): Promise<OfflineCanvasDoc | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CANVAS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CANVAS_STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  },

  async deleteDoc(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CANVAS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CANVAS_STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },
};
