/** Persistent identities distinguish credentials and headers while keeping secrets out of CacheStorage keys. */
import { expect, test } from 'vitest';
import { offlineKey } from '../../../src/offline/key';
import { observeConnectivity } from '../../../src/offline/connectivity';
import { OfflineStore } from '../../../src/index';

test('normalizes fragments/header order and partitions exact request semantics without exposing secrets', async () => {
  const first = new Request('https://original.invalid/chapter.xhtml?edition=2#one', {
    credentials: 'include',
    headers: { Authorization: 'Bearer original-secret', Accept: 'text/plain' },
  });
  const second = new Request('https://original.invalid/chapter.xhtml?edition=2#two', {
    credentials: 'include',
    headers: { Accept: 'text/plain', authorization: 'Bearer original-secret' },
  });
  const key = await offlineKey(first);
  expect(key).toMatch(/^https:\/\/folio-cache\.invalid\/v1\/[\da-f]{64}$/);
  expect(key).not.toContain('original-secret');
  expect(await offlineKey(second)).toBe(key);
  expect(await offlineKey(new Request(first, { credentials: 'omit' }))).not.toBe(key);
  expect(
    await offlineKey(new Request(first, { headers: { authorization: 'another-user' } })),
  ).not.toBe(key);
  expect(
    await offlineKey(new Request('https://original.invalid/chapter.xhtml?edition=3')),
  ).not.toBe(key);
  expect(await offlineKey(new Request('blob:https://original.invalid/owned'))).toContain('/v1/');
});

test('rejects unsupported methods/protocols and keeps browser persistence explicitly optional in Node', async () => {
  await expect(
    offlineKey(new Request('https://original.invalid/', { method: 'POST' })),
  ).rejects.toThrow('GET');
  await expect(offlineKey(new Request('data:text/plain,original'))).rejects.toThrow('protocol');
  for (const name of ['', 'path/name', 'a'.repeat(129)]) {
    expect(() => new OfflineStore(name)).toThrow('names');
  }
  expect(() => new OfflineStore('headless-unavailable')).toThrow('CacheStorage');
  const release = observeConnectivity(() => {
    throw new Error('No browser connectivity expected.');
  });
  release();
});
