// A tiny IndexedDB helper focused on storing/retrieving manual clip blobs by clipId

import type { ManualClipMetadata } from "@/types/app";

const DB_NAME = "zinc_clip_editor";
const DB_VERSION = 2;
const STORE_MANUAL_CLIPS = "manualClips";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MANUAL_CLIPS)) {
        db.createObjectStore(STORE_MANUAL_CLIPS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_MANUAL_CLIPS, mode);
    const store = tx.objectStore(STORE_MANUAL_CLIPS);

    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export interface ManualClipRecord {
  clipId: string;
  file: Blob;
  metadata: ManualClipMetadata;
}

export async function idbSaveManualClipRecord(
  record: ManualClipRecord
): Promise<void> {
  await withStore("readwrite", (store) => {
    store.put(record, record.clipId);
  });
}

export async function idbGetManualClipRecord(
  clipId: string
): Promise<ManualClipRecord | null> {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(clipId);
      req.onsuccess = () => {
        const value = req.result as unknown;
        if (!value) return resolve(null);
        if (value instanceof Blob) return resolve(null);
        resolve(value as ManualClipRecord);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function idbGetAllManualClipRecords(): Promise<
  ManualClipRecord[]
> {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const results: ManualClipRecord[] = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result as IDBCursorWithValue | null;
        if (cursor) {
          const val = cursor.value as unknown;
          if (val && !(val instanceof Blob))
            results.push(val as ManualClipRecord);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  });
}

export async function idbDeleteManualClip(clipId: string): Promise<void> {
  await withStore("readwrite", (store) => {
    store.delete(clipId);
  });
}

export async function idbHasManualClip(clipId: string): Promise<boolean> {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getKey(clipId);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => reject(req.error);
    });
  });
}
