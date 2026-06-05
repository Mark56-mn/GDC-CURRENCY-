self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  const dbName = 'gdc_v2';
  const dbVersion = 2;

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  const getPending = () => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('pending', 'readonly');
      const store = tx.objectStore('pending');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch(e) { resolve([]); }
  });

  const deletePending = (id) => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch(e) { resolve(); }
  });

  const saveFailed = (obj) => new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('failed', 'readwrite');
      const store = tx.objectStore('failed');
      const req = store.put(obj);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch(e) { resolve(); }
  });

  const pending = await getPending();
  if (!pending || pending.length === 0) return;

  for (const txObj of pending) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: txObj.payload })
      });

      if (response.ok) {
        await deletePending(txObj.id);
      } else {
        txObj.error = await response.text();
        await saveFailed(txObj);
        await deletePending(txObj.id);
      }
    } catch (err) {
      // Network error, leave it pending
      throw err; 
    }
  }
}

