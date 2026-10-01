// SICA - IndexedDB Offline Storage and Sync Manager
const SICA_OFFLINE_DB = 'sica_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(SICA_OFFLINE_DB, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('offline_accesos')) {
          db.createObjectStore('offline_accesos', { keyPath: 'uid' });
        }
        if (!db.objectStoreNames.contains('offline_bitacoras')) {
          db.createObjectStore('offline_bitacoras', { keyPath: 'uid' });
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }
  return dbPromise;
}

// Generate client unique ID
function generateUid() {
  return 'offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Save access record when offline
async function saveOfflineAcceso(data) {
  const db = await getOfflineDB();
  const uid = generateUid();
  const record = {
    ...data,
    uid,
    fecha_hora: data.fecha_hora || new Date().toISOString().replace('T', ' ').substring(0, 19),
    sincronizado_offline: 1,
    savedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_accesos', 'readwrite');
    const store = tx.objectStore('offline_accesos');
    const req = store.add(record);
    req.onsuccess = () => {
      notifyOfflineCountChange();
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

// Save bitácora record when offline
async function saveOfflineBitacora(data) {
  const db = await getOfflineDB();
  const uid = generateUid();
  const record = {
    ...data,
    uid,
    fecha_hora_registro: data.fecha_hora_registro || new Date().toISOString().replace('T', ' ').substring(0, 19),
    atendida_supervisor: 0,
    savedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_bitacoras', 'readwrite');
    const store = tx.objectStore('offline_bitacoras');
    const req = store.add(record);
    req.onsuccess = () => {
      notifyOfflineCountChange();
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

// Get all offline accesos
async function getOfflineAccesos() {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_accesos', 'readonly');
    const store = tx.objectStore('offline_accesos');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Get all offline bitacoras
async function getOfflineBitacoras() {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_bitacoras', 'readonly');
    const store = tx.objectStore('offline_bitacoras');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Get total offline pending records
async function getOfflineCount() {
  try {
    const accesos = await getOfflineAccesos();
    const bitacoras = await getOfflineBitacoras();
    return {
      accesosCount: accesos.length,
      bitacorasCount: bitacoras.length,
      total: accesos.length + bitacoras.length
    };
  } catch (e) {
    return { accesosCount: 0, bitacorasCount: 0, total: 0 };
  }
}

// Remove synced records by UIDs
async function removeOfflineItems(storeName, uids) {
  if (!uids || uids.length === 0) return;
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    uids.forEach(uid => store.delete(uid));
    tx.oncomplete = () => {
      notifyOfflineCountChange();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Sync all offline records with server
async function syncAllOfflineRecords() {
  const counts = await getOfflineCount();
  if (counts.total === 0) {
    return { synced: 0, message: 'No hay registros pendientes de sincronizar' };
  }

  let totalSynced = 0;

  // 1. Sync accesos
  const accesos = await getOfflineAccesos();
  if (accesos.length > 0) {
    try {
      const res = await window.SICA_API.syncAccesos(accesos);
      const uidsToRemove = accesos.map(a => a.uid);
      await removeOfflineItems('offline_accesos', uidsToRemove);
      totalSynced += accesos.length;
    } catch (err) {
      console.error('[OFFLINE SYNC] Error sincronizando accesos:', err);
    }
  }

  // 2. Sync bitacoras
  const bitacoras = await getOfflineBitacoras();
  if (bitacoras.length > 0) {
    try {
      const res = await window.SICA_API.syncBitacoras(bitacoras);
      const uidsToRemove = bitacoras.map(b => b.uid);
      await removeOfflineItems('offline_bitacoras', uidsToRemove);
      totalSynced += bitacoras.length;
    } catch (err) {
      console.error('[OFFLINE SYNC] Error sincronizando bitacoras:', err);
    }
  }

  notifyOfflineCountChange();
  return {
    synced: totalSynced,
    message: totalSynced > 0
      ? `Se sincronizaron exitosamente ${totalSynced} registros locales con el servidor central.`
      : 'No se pudo sincronizar en este momento. Verifique la conexión con el servidor.'
  };
}

// Trigger custom event so UI badges update
function notifyOfflineCountChange() {
  getOfflineCount().then(counts => {
    window.dispatchEvent(new CustomEvent('sica:offline-count-updated', { detail: counts }));
  });
}

// Export to window
window.SICA_OFFLINE = {
  saveOfflineAcceso,
  saveOfflineBitacora,
  getOfflineAccesos,
  getOfflineBitacoras,
  getOfflineCount,
  syncAllOfflineRecords,
  notifyOfflineCountChange
};
