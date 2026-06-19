// Canvas Image Storage — IndexedDB layer for canvas block images
// Mirrors the existing imageStorage.ts pattern used by docs

class CanvasImageStorage {
  private dbName = 'ReviseCanvasImagesDB';
  private storeName = 'images';
  private db: IDBDatabase | null = null;

  async init() {
    if (this.db) return;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  // Store original File/Blob
  async storeImage(id: string, file: File | Blob): Promise<string> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(file, id);
      
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve original File/Blob
  async getImage(id: string): Promise<Blob | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete image
  async deleteImage(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Delete multiple images at once
  async deleteImages(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      for (const id of ids) {
        const request = store.delete(id);
        request.onsuccess = () => {
          completed++;
          if (completed === ids.length) resolve();
        };
        request.onerror = () => reject(request.error);
      }
    });
  }

  // Create temporary object URL for display
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  // Cleanup object URL
  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const canvasImageStorage = new CanvasImageStorage();
