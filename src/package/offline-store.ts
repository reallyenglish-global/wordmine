import { packageDownloadKey, type DownloadedPackage } from './download';
import { readPackage, type ContentPackage } from './reader';

const DATABASE = 'wordmine-offline-packs-v0';
const STORE = 'packs';
const DATABASE_VERSION = 1;

type StoredPackage = {
  key: string;
  packageId: string;
  contentVersion: string;
  title: string;
  targetLanguage: string;
  manifestHash: string;
  totalBytes: number;
  downloadedAt: number;
  files: Record<string, Uint8Array>;
};
export type OfflinePackageSummary = Omit<StoredPackage, 'files' | 'downloadedAt'> & { downloadedAt: number };

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Package storage unavailable'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath:'key'});
    };
    request.onsuccess = () => {
      if (settled) request.result.close();
      else { settled = true; resolve(request.result); }
    };
    request.onerror = () => { if (!settled) { settled = true; reject(new Error('Package storage unavailable')); } };
    request.onblocked = () => { if (!settled) { settled = true; reject(new Error('Package storage unavailable')); } };
  });
}

function transact<T>(database: IDBDatabase, mode: IDBTransactionMode, operation: (store: IDBObjectStore, setResult: (value:T)=>void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    let transaction: IDBTransaction;
    try { transaction = database.transaction(STORE, mode); }
    catch { reject(new Error('Package storage unavailable')); return; }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(new Error('Package storage unavailable'));
    transaction.onabort = () => reject(new Error('Package storage unavailable'));
    try { operation(transaction.objectStore(STORE), value => { result = value; }); }
    catch {
      try { transaction.abort(); } catch { /* transaction already inactive */ }
      reject(new Error('Package storage unavailable'));
    }
  });
}

function validatePackage(files: Record<string, Uint8Array>, expectedKey?: string): {content:ContentPackage;totalBytes:number} {
  try {
    const content = readPackage(files);
    const key = packageDownloadKey(content);
    if (expectedKey && key !== expectedKey) throw new Error('identity mismatch');
    const totalBytes = Object.values(files).reduce((total, bytes) => total + bytes.byteLength, 0);
    return {content,totalBytes};
  } catch { throw new Error('Package rejected: stored package could not be validated'); }
}

function summary(content: ContentPackage, totalBytes: number, downloadedAt: number): OfflinePackageSummary {
  return {
    key:packageDownloadKey(content), packageId:content.manifest.packageId,
    contentVersion:content.manifest.contentVersion, title:content.manifest.title.text,
    targetLanguage:content.manifest.languages.target, manifestHash:content.manifestHash,
    totalBytes, downloadedAt,
  };
}

/** Stores only fully validated package bytes. Learner progress is stored separately. */
export async function saveOfflinePackage(candidate: DownloadedPackage): Promise<OfflinePackageSummary> {
  const checked = validatePackage(candidate.files, packageDownloadKey(candidate.content));
  const item = summary(checked.content, checked.totalBytes, Date.now());
  const files = Object.fromEntries(Object.entries(candidate.files).map(([path,bytes]) => [path,Uint8Array.from(bytes)]));
  const database = await openDatabase();
  try {
    await transact<void>(database, 'readwrite', (store,setResult) => {
      store.put({...item,files});
      setResult(undefined);
    });
    return item;
  } finally { database.close(); }
}

/** Lists local package metadata. Bytes are revalidated before any package is opened for study. */
export async function listOfflinePackages(): Promise<OfflinePackageSummary[]> {
  const database = await openDatabase();
  try {
    const records = await transact<StoredPackage[]>(database, 'readonly', (store,setResult) => {
      const request = store.getAll();
      request.onsuccess = () => setResult(request.result as StoredPackage[]);
    });
    return records.map(record => ({
      key:record.key, packageId:record.packageId, contentVersion:record.contentVersion,
      title:record.title, targetLanguage:record.targetLanguage, manifestHash:record.manifestHash,
      totalBytes:record.totalBytes, downloadedAt:record.downloadedAt,
    }));
  } finally { database.close(); }
}

export async function loadOfflinePackage(key: string): Promise<DownloadedPackage | null> {
  const database = await openDatabase();
  try {
    const record = await transact<StoredPackage | undefined>(database, 'readonly', (store,setResult) => {
      const request = store.get(key);
      request.onsuccess = () => setResult(request.result as StoredPackage | undefined);
    });
    if (!record) return null;
    if (!record.files || typeof record.files !== 'object' || Array.isArray(record.files)) {
      throw new Error('Package rejected: stored package could not be validated');
    }
    const files = Object.fromEntries(Object.entries(record.files).map(([path,bytes]) => {
      if (!(bytes instanceof Uint8Array)) throw new Error('Package rejected: stored package could not be validated');
      return [path,Uint8Array.from(bytes)];
    }));
    const checked = validatePackage(files,key);
    return {content:checked.content,files,totalBytes:checked.totalBytes};
  } finally { database.close(); }
}

export async function removeOfflinePackage(key: string): Promise<void> {
  const database = await openDatabase();
  try {
    await transact<void>(database, 'readwrite', (store,setResult) => {
      store.delete(key);
      setResult(undefined);
    });
  } finally { database.close(); }
}
