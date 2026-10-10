// 最小限の IndexedDB ラッパー（写真キャラは端末内にのみ保存）
const DB = 'punch-flight';
const STORE = 'characters';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB not supported'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r?.result);
        t.onerror = () => reject(t.error);
      }),
  );
}

export const charStore = {
  all: () => tx('readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => x.createdAt - y.createdAt)),
  put: (rec) => tx('readwrite', (s) => s.put(rec)),
  delete: (id) => tx('readwrite', (s) => s.delete(id)),
  clear: () => tx('readwrite', (s) => s.clear()),
};
