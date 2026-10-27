/* Almacenamiento local para usar la app sin conexión.
   IndexedDB guarda sin el límite de 5 MB de localStorage (estado completo, fotos por subir).
   Si no está disponible (modo privado antiguo), se usa localStorage. */
const DB = "vytrafit";
const STORE = "kv";
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbp = null; };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      setTimeout(() => resolve(null), 3000); // Safari a veces no responde: no se bloquea el arranque
    } catch { resolve(null); }
  });
  return dbp;
}

const lsKey = (k) => `fcp.kv.${k}`;

export async function kvGet(key) {
  const db = await open();
  if (!db) { try { return JSON.parse(localStorage.getItem(lsKey(key)) || "null"); } catch { return null; } }
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

/* Las escrituras se encadenan: siempre queda guardada la última */
let chain = Promise.resolve();
export function kvSet(key, value) {
  chain = chain.then(async () => {
    const db = await open();
    if (!db) {
      try { if (value == null) localStorage.removeItem(lsKey(key)); else localStorage.setItem(lsKey(key), JSON.stringify(value)); } catch { /* sin espacio */ }
      return;
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        const st = tx.objectStore(STORE);
        if (value == null) st.delete(key); else st.put(value, key);
        tx.oncomplete = resolve; tx.onerror = resolve; tx.onabort = resolve;
      } catch { resolve(); }
    });
  });
  return chain;
}

/** Pide al navegador que no borre los datos de la app (iPhone/Safari los puede borrar si falta espacio). */
export function askPersist() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* nada */ }
}
