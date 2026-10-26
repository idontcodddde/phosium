const DB_NAME = "PhosiumVFS";
const STORE_NAME = "files";
const DB_VERSION = 1;

export interface VFSFile {
    path: string;
    content: string;
    updatedAt: number;
}

export function openVFSDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            return reject(new Error("VFS only runs in browser environment."));
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "path" });
            }
        };
    });
}

export async function dbWriteFile(
    path: string,
    content: string,
): Promise<void> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const fileRecord: VFSFile = {
            path,
            content,
            updatedAt: Date.now(),
        };
        const request = store.put(fileRecord);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function dbReadFile(path: string): Promise<string | null> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(path);
        request.onsuccess = () => {
            const result = request.result as VFSFile | undefined;
            resolve(result ? result.content : null);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function dbListFiles(): Promise<string[]> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
    });
}

export async function dbDeleteFile(path: string): Promise<void> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(path);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
