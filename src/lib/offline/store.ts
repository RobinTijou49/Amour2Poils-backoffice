import type { OfflineSnapshot, QueuedAction } from "./types";

// Petit accès à IndexedDB (navigateur uniquement). Deux magasins :
//  - "kv" : l'instantané de la journée (une seule entrée, supprimée à la déconnexion) ;
//  - "queue" : les gestes à rejouer (ne contient que des identifiants, aucune donnée personnelle de client).

const DB_NAME = "a2p-offline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
      req.result.createObjectStore("queue", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const saveSnapshot = (s: OfflineSnapshot) => run("kv", "readwrite", (st) => st.put(s, "snapshot")).then(() => undefined);
export const loadSnapshot = () => run<OfflineSnapshot | undefined>("kv", "readonly", (st) => st.get("snapshot"));
export const clearSnapshot = () => run("kv", "readwrite", (st) => st.delete("snapshot")).then(() => undefined);

export const addToQueue = (a: QueuedAction) => run("queue", "readwrite", (st) => st.put(a)).then(() => undefined);
export const removeFromQueue = (id: string) => run("queue", "readwrite", (st) => st.delete(id)).then(() => undefined);
export async function loadQueue() {
  const all = await run<QueuedAction[]>("queue", "readonly", (st) => st.getAll());
  return all.sort((a, b) => a.at.localeCompare(b.at));
}
