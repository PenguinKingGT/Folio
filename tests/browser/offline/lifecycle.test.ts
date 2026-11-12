/** Connectivity and persistence lifetimes cancel held transports without stale writes or leaked native listeners. */
import { expect, test } from 'vitest';
import { OfflineStore, OfflineMissError } from '../../../src/index';
import { gate } from '../../unit/extensions/fixture';
import { removeOfflineCache } from './fixture';

test('native connectivity transitions deduplicate events and are detached on destruction', async () => {
  const name = 'test-offline-connectivity';
  const store = new OfflineStore(name, { online: true });
  const events: string[] = [];
  store.on('offline', () => events.push('offline'));
  store.on('online', () => events.push('online'));
  store.once('destroyed', () => events.push('destroyed'));
  window.dispatchEvent(new Event('offline'));
  window.dispatchEvent(new Event('offline'));
  expect(store.online).toBe(false);
  window.dispatchEvent(new Event('online'));
  expect(store.online).toBe(true);
  store.setOnline(false);
  store.destroy();
  store.destroy();
  window.dispatchEvent(new Event('online'));
  expect(store.online).toBe(false);
  expect(events).toEqual(['offline', 'online', 'offline', 'destroyed']);
  expect(() => store.setOnline(true)).toThrow();
  expect(() => store.wrap(fetch)).toThrow();
  expect(() => store.clear()).toThrow();
  await expect(store.retrieve('https://original.invalid/closed')).rejects.toThrow();
  expect(() => store.on('offline', () => {})).toThrow('destroyed');
  await removeOfflineCache(name);
});

for (const action of ['abort', 'clear', 'destroy'] as const) {
  test(`${action} cancels an uncooperative network wait without persisting late data`, async () => {
    const name = `test-offline-cancel-${action}`;
    const store = new OfflineStore(name, { online: true, observeConnectivity: false });
    await store.clear();
    const started = gate();
    const waiting = gate();
    const errors: unknown[] = [];
    store.on('error', (error) => errors.push(error));
    const fetcher = store.wrap(async () => {
      started.release();
      await waiting.promise;
      return new Response('stale');
    });
    const controller = new AbortController();
    const rejected = expect(
      fetcher('https://original.invalid/held', { signal: controller.signal }),
    ).rejects.toThrow();
    try {
      await started.promise;
      if (action === 'abort') {
        controller.abort();
      } else if (action === 'clear') {
        await store.clear();
      } else {
        store.destroy();
      }
      await rejected;
      waiting.release();
      const fresh = new OfflineStore(name, { online: false, observeConnectivity: false });
      try {
        await expect(fresh.retrieve('https://original.invalid/held')).rejects.toBeInstanceOf(
          OfflineMissError,
        );
      } finally {
        fresh.destroy();
      }
      expect(errors).toEqual([]);
    } finally {
      waiting.release();
      store.destroy();
      await removeOfflineCache(name);
    }
  });
}

test('pre-abort prevents transport invocation and runtime connectivity/transport options are validated', async () => {
  const name = 'test-offline-validation';
  const store = new OfflineStore(name, { online: true, observeConnectivity: false });
  try {
    for (const options of [{ online: 'yes' }, { observeConnectivity: null }]) {
      expect(() => {
        Reflect.construct(OfflineStore, [name, options]);
      }).toThrow(TypeError);
    }
    expect(() => {
      Reflect.apply(store.setOnline.bind(store), store, [1]);
    }).toThrow(TypeError);
    expect(() => {
      Reflect.apply(store.wrap.bind(store), store, [null]);
    }).toThrow(TypeError);
    const controller = new AbortController();
    controller.abort();
    let called = false;
    const fetcher = store.wrap(() => {
      called = true;
      return Promise.resolve(new Response('unused'));
    });
    await expect(
      fetcher('https://original.invalid/pre-aborted', { signal: controller.signal }),
    ).rejects.toThrow();
    expect(called).toBe(false);
  } finally {
    store.destroy();
    await removeOfflineCache(name);
  }
});
