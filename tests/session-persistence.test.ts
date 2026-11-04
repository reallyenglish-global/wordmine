import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionPersistence, type PersistenceStatus, type SessionStorage } from '../src/storage/sessionPersistence';

// Characterization of the load/locked-save lifecycle that App.tsx and PackagePreview.tsx used to
// carry separately. Expected values come from the original component code, not from the new seam.

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

type FakeStorage = SessionStorage & {
  items: Map<string, string>;
  reads: string[]; writes: [string, string][];
  failRead: boolean; failWrite: boolean;
  pendingWrites: Deferred<void>[]; pendingReads: Deferred<string | null>[];
};
function fakeStorage(manual = false): FakeStorage {
  const storage: FakeStorage = {
    items: new Map(), reads: [], writes: [], failRead: false, failWrite: false, pendingWrites: [], pendingReads: [],
    async getItem(key) {
      storage.reads.push(key);
      if (manual) { const d = deferred<string | null>(); storage.pendingReads.push(d); return d.promise; }
      if (storage.failRead) throw new Error('denied');
      return storage.items.get(key) ?? null;
    },
    async setItem(key, value) {
      storage.writes.push([key, value]);
      if (manual) { const d = deferred<void>(); storage.pendingWrites.push(d); return d.promise; }
      if (storage.failWrite) throw new Error('denied');
      storage.items.set(key, value);
    },
  };
  return storage;
}

type Session = { index: number; answers: string[] };
const initial: Session = { index: 0, answers: [] };
const restore = (raw: string | null): Session => raw ? JSON.parse(raw) as Session : initial;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function harness(storage: SessionStorage) {
  const sessions: Session[] = [];
  const statuses: PersistenceStatus[] = [];
  const persistence = createSessionPersistence<Session>(storage, {
    onSession: session => sessions.push(session),
    onStatus: status => statuses.push(status),
  });
  return { persistence, sessions, statuses };
}

test('load applies the restored session, marks ready and leaves storageError untouched on success', async () => {
  const storage = fakeStorage();
  storage.items.set('k', JSON.stringify({ index: 2, answers: ['a', 'b'] }));
  const { persistence, sessions, statuses } = harness(storage);
  persistence.load('k', restore);
  assert.deepEqual(statuses, [{ ready: false, saving: false, storageError: false }]);
  await flush();
  assert.deepEqual(sessions, [{ index: 2, answers: ['a', 'b'] }]);
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: false }.ready === false
    ? { ready: true, saving: false, storageError: false } : undefined);
  assert.deepEqual(storage.reads, ['k']);
});

test('a failed read still resolves to ready, flags storageError and does not replace the session', async () => {
  const storage = fakeStorage();
  storage.failRead = true;
  const { persistence, sessions, statuses } = harness(storage);
  persistence.load('k', restore);
  await flush();
  assert.deepEqual(sessions, []);
  assert.deepEqual(statuses.at(-1), { ready: true, saving: false, storageError: true });
});

test('a cancelled load applies neither the session nor ready', async () => {
  const storage = fakeStorage(true);
  const { persistence, sessions, statuses } = harness(storage);
  const cancel = persistence.load('k', restore);
  cancel();
  storage.pendingReads[0].resolve(JSON.stringify({ index: 1, answers: ['x'] }));
  await flush();
  assert.deepEqual(sessions, []);
  assert.deepEqual(statuses, [{ ready: false, saving: false, storageError: false }]);
});

test('re-running load for another key resets ready first and the earlier read cannot apply late', async () => {
  const storage = fakeStorage(true);
  const { persistence, sessions, statuses } = harness(storage);
  const cancelFirst = persistence.load('first', restore);
  storage.pendingReads[0].resolve(null);
  await flush();
  assert.deepEqual(statuses.at(-1), { ready: true, saving: false, storageError: false });
  cancelFirst();
  persistence.load('second', restore);
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: false });
  storage.pendingReads[1].resolve(JSON.stringify({ index: 3, answers: ['a', 'b', 'c'] }));
  await flush();
  assert.deepEqual(sessions, [initial, { index: 3, answers: ['a', 'b', 'c'] }]);
  assert.deepEqual(statuses.at(-1), { ready: true, saving: false, storageError: false });
  assert.deepEqual(storage.reads, ['first', 'second']);
});

test('save applies the session before the write, reports saving, then clears saving and storageError', async () => {
  const storage = fakeStorage(true);
  const { persistence, sessions, statuses } = harness(storage);
  const next = { index: 1, answers: ['a'] };
  const done = persistence.save('k', next);
  assert.deepEqual(sessions, [next]);
  assert.deepEqual(statuses, [{ ready: false, saving: true, storageError: false }]);
  assert.deepEqual(storage.writes, [['k', JSON.stringify(next)]]);
  storage.pendingWrites[0].resolve();
  await done;
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: false });
  assert.equal(statuses.length, 2);
});

test('a failed write keeps the applied session, sets storageError and a later success clears it', async () => {
  const storage = fakeStorage();
  const { persistence, sessions, statuses } = harness(storage);
  storage.failWrite = true;
  await persistence.save('k', { index: 1, answers: ['a'] });
  assert.deepEqual(sessions, [{ index: 1, answers: ['a'] }]);
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: true });
  storage.failWrite = false;
  await persistence.save('k', { index: 2, answers: ['a', 'b'] });
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: false });
  assert.deepEqual(storage.items.get('k'), JSON.stringify({ index: 2, answers: ['a', 'b'] }));
});

test('a save issued while a write is pending is dropped entirely, and the lock survives a key change', async () => {
  const storage = fakeStorage(true);
  const { persistence, sessions, statuses } = harness(storage);
  const first = persistence.save('k', { index: 1, answers: ['a'] });
  await persistence.save('k', { index: 9, answers: ['ignored'] });
  await persistence.save('other', { index: 9, answers: ['ignored'] });
  assert.deepEqual(sessions, [{ index: 1, answers: ['a'] }]);
  assert.equal(storage.writes.length, 1);
  storage.pendingWrites[0].reject(new Error('denied'));
  await first;
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: true });
  await persistence.save('k', { index: 2, answers: ['a', 'b'] });
  assert.equal(storage.writes.length, 2);
  assert.deepEqual(sessions.at(-1), { index: 2, answers: ['a', 'b'] });
});

test('a value that cannot be serialized is reported as a storage error without reaching storage', async () => {
  const storage = fakeStorage();
  const { persistence, sessions, statuses } = harness(storage);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  await persistence.save('k', cyclic as unknown as Session);
  assert.equal(sessions.length, 1);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(statuses.at(-1), { ready: false, saving: false, storageError: true });
});

test('identical consecutive statuses are not re-emitted', async () => {
  const storage = fakeStorage();
  const { persistence, statuses } = harness(storage);
  persistence.load('k', restore);
  await flush();
  const count = statuses.length;
  const cancel = persistence.load('k', restore);
  // Re-running a load resets ready, so exactly one new status is expected here.
  assert.equal(statuses.length, count + 1);
  cancel();
});
