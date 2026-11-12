/** Native storage failures remain observable and namespace deletion can recover after a failed storage boundary. */
import { expect, test } from 'vitest';
import { OfflineStore, OfflineMissError } from '../../../src/index';
import { removeOfflineCache } from './fixture';

test('storage errors preserve identity and a second clear can recover a rejected deletion barrier', async () => {
  const name = 'test-offline-storage-errors';
  const failure = new Error('original storage failure');
  let failOpen = true;
  let failDelete = true;
  const storage: CacheStorage = {
    open: (cacheName) => (failOpen ? Promise.reject(failure) : caches.open(cacheName)),
    delete: (cacheName) => {
      if (failDelete) {
        failDelete = false;
        return Promise.reject(failure);
      }
      return caches.delete(cacheName);
    },
    has: (cacheName) => caches.has(cacheName),
    keys: () => caches.keys(),
    match: (request, options) => caches.match(request, options),
  };
  const store = new OfflineStore(name, { storage, observeConnectivity: false, online: true });
  const errors: unknown[] = [];
  store.on('error', (error) => errors.push(error));
  const url = 'https://original.invalid/storage';
  try {
    await expect(store.retrieve(url)).rejects.toBe(failure);
    expect(errors).toEqual([failure]);
    failOpen = false;
    await expect(store.clear()).rejects.toBe(failure);
    await expect(store.retrieve(url)).rejects.toBe(failure);
    await store.clear();
    await expect(store.retrieve(url)).rejects.toBeInstanceOf(OfflineMissError);
    const fetcher = store.wrap(() => Promise.resolve(new Response('recovered')));
    expect(await (await fetcher(url)).text()).toBe('recovered');
    expect(await (await store.retrieve(url)).text()).toBe('recovered');
  } finally {
    store.destroy();
    await removeOfflineCache(name);
  }
});
