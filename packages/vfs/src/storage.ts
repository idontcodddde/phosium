const DB_NAME = "PhosiumVFS";
const STORE_NAME = "files";
const DB_VERSION = 1;

export interface VFSNode {
    path: string; // e.g., "/documents/notes.txt" or "/documents"
    type: "file" | "directory";
    content?: string;
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

export async function dbPutNode(node: VFSNode): Promise<void> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(node);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function dbGetNode(path: string): Promise<VFSNode | null> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(path);
        request.onsuccess = () => resolve((request.result as VFSNode) || null);
        request.onerror = () => reject(request.error);
    });
}

export async function dbListNodes(): Promise<VFSNode[]> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as VFSNode[]);
        request.onerror = () => reject(request.error);
    });
}

export async function dbDeleteNode(path: string): Promise<void> {
    const db = await openVFSDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(path);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
