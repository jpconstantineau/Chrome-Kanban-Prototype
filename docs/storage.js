import { validateState } from './state.js';

const DATABASE = 'local-kanban';
const STORE = 'board';
const KEY = 'snapshot';
let connection;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable. Use a normal Chrome window with browser storage enabled.'));
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) { database.close(); return; }
      database.onversionchange = () => { database.close(); connection = null; };
      resolve(database);
    };
    request.onerror = () => { connection = null; reject(new Error('Could not open board storage.', { cause: request.error })); };
    request.onblocked = () => { blocked = true; connection = null; reject(new Error('Board storage is blocked. Close other board tabs and reload.')); };
  });
  return connection;
}

async function transaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    let value;
    const request = operation(tx.objectStore(STORE));
    request.onsuccess = () => { value = request.result; };
    // A request succeeding does not mean its transaction was committed.
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(new Error('Could not save or load board data.', { cause: tx.error ?? request.error }));
    tx.onerror = () => {};
  });
}

export async function loadState() {
  const state = await transaction('readonly', store => store.get(KEY));
  return state === undefined ? null : validateState(state);
}

export async function saveState(state) {
  validateState(state);
  await transaction('readwrite', store => store.put(state, KEY));
}
