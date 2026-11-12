/** Persistent request policy preserves HTTP failures, exact credentials, explicit misses, and cache directives. */
import { expect, test } from 'vitest';
import { OfflineStore, OfflineMissError } from '../../../src/index';
import { removeOfflineCache } from './fixture';

test('online reads refresh persisted responses, retrieval stays offline, and authentication identities remain separated', async () => {
  const name = 'test-offline-requests';
  const store = new OfflineStore(name, { online: true, observeConnectivity: false });
  await store.clear();
  let calls = 0;
  const fetcher = store.wrap((input) => {
    calls += 1;
    const request = new Request(input);
    return Promise.resolve(new Response(`${calls}:${request.headers.get('authorization')}`));
  });
  const url = 'https://original.invalid/chapter';
  const options: RequestInit = {
    credentials: 'include',
    headers: { authorization: 'original-user' },
  };
  try {
    expect(await (await fetcher(url, options)).text()).toBe('1:original-user');
    expect(await (await fetcher(url, options)).text()).toBe('2:original-user');
    expect(await (await store.retrieve(url, options)).text()).toBe('2:original-user');
    store.setOnline(false);
    expect(await (await fetcher(url, options)).text()).toBe('2:original-user');
    expect(calls).toBe(2);
    await expect(fetcher(url, { ...options, credentials: 'omit' })).rejects.toBeInstanceOf(
      OfflineMissError,
    );
    await expect(
      fetcher(url, { ...options, headers: { authorization: 'another-user' } }),
    ).rejects.toBeInstanceOf(OfflineMissError);
    await store.clear();
    await expect(store.retrieve(url, options)).rejects.toBeInstanceOf(OfflineMissError);
  } finally {
    store.destroy();
    await removeOfflineCache(name);
  }
});

test('transport failures can use persisted content while HTTP and non-transport errors stay visible', async () => {
  const name = 'test-offline-fallback';
  const store = new OfflineStore(name, { online: true, observeConnectivity: false });
  await store.clear();
  const url = 'https://original.invalid/available';
  try {
    await store.wrap(() => Promise.resolve(new Response('original')))(url);
    const failure = new TypeError('network unavailable');
    const broken = store.wrap(() => Promise.reject(failure));
    expect(await (await broken(url)).text()).toBe('original');
    await expect(broken('https://original.invalid/missing')).rejects.toBe(failure);
    const custom = new Error('custom host failure');
    await expect(store.wrap(() => Promise.reject(custom))(url)).rejects.toBe(custom);
    const denied = await store.wrap(() => Promise.resolve(new Response('denied', { status: 401 })))(
      url,
    );
    expect(denied.status).toBe(401);
    expect(await (await store.retrieve(url)).text()).toBe('original');
  } finally {
    store.destroy();
    await removeOfflineCache(name);
  }
});

test('HTTP failures, partial responses, wildcard Vary, and no-store responses are never persisted', async () => {
  const name = 'test-offline-directives';
  const store = new OfflineStore(name, { online: true, observeConnectivity: false });
  await store.clear();
  const responses = [
    new Response('missing', { status: 404 }),
    new Response('partial', { status: 206 }),
    new Response('vary', { headers: { vary: 'Accept, *' } }),
    new Response('private', { headers: { 'cache-control': 'max-age=0, no-store' } }),
  ];
  try {
    for (const [index, response] of responses.entries()) {
      const url = `https://original.invalid/excluded-${index}`;
      expect(await store.wrap(() => Promise.resolve(response))(url)).toBe(response);
      await expect(store.retrieve(url)).rejects.toBeInstanceOf(OfflineMissError);
    }
  } finally {
    store.destroy();
    await removeOfflineCache(name);
  }
});

test('independent instances see namespace deletion without retaining stale Cache handles', async () => {
  const name = 'test-offline-shared';
  const first = new OfflineStore(name, { online: true, observeConnectivity: false });
  const second = new OfflineStore(name, { online: false, observeConnectivity: false });
  const unrelated = new OfflineStore(`${name}-other`, { online: true, observeConnectivity: false });
  await first.clear();
  await unrelated.clear();
  const url = 'https://original.invalid/shared';
  try {
    await first.wrap(() => Promise.resolve(new Response('first')))(url);
    await unrelated.wrap(() => Promise.resolve(new Response('other')))(url);
    expect(await (await second.retrieve(url)).text()).toBe('first');
    await first.clear();
    await expect(second.retrieve(url)).rejects.toBeInstanceOf(OfflineMissError);
    expect(await (await unrelated.retrieve(url)).text()).toBe('other');
  } finally {
    first.destroy();
    second.destroy();
    unrelated.destroy();
    await removeOfflineCache(name);
    await removeOfflineCache(`${name}-other`);
  }
});
