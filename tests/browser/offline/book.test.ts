/** Persisted archive/directory requests reopen offline and keep Blob URL ownership within each book. */
import { expect, test } from 'vitest';
import { Book, OfflineStore, OfflineMissError } from '../../../src/index';
import { offlineTransport, removeOfflineCache } from './fixture';
import { host } from '../render/fixture';

for (const directory of [false, true]) {
  test(`reopens a persisted ${directory ? 'directory' : 'archive'} without any network request`, async () => {
    const name = directory ? 'test-offline-directory' : 'test-offline-archive';
    const store = new OfflineStore(name, { observeConnectivity: false, online: true });
    await store.clear();
    const transport = offlineTransport();
    const url = directory
      ? 'https://original.invalid/publication/'
      : 'https://original.invalid/book.epub';
    const container = host();
    try {
      const first = await Book.open(url, { offline: store, fetch: transport.fetch });
      expect(await first.prefetchResources()).toBe(first.publication.manifest.size);
      const firstCover = await first.resources.url('images/cover.jpg');
      expect(await (await fetch(firstCover)).text()).toBe('original cover bytes');
      first.destroy();
      await expect(fetch(firstCover)).rejects.toThrow();
      const calls = transport.count();
      store.destroy();
      const restored = new OfflineStore(name, { online: false, observeConnectivity: false });
      try {
        const second = await Book.open(url, { offline: restored, fetch: transport.fetch });
        const reader = second.renderTo(container);
        await reader.display();
        expect(reader.getContents()?.body.textContent).toContain('Original chapter');
        const secondCover = await second.resources.url('images/cover.jpg');
        expect(await (await fetch(secondCover)).text()).toBe('original cover bytes');
        expect(transport.count()).toBe(calls);
        second.destroy();
        await expect(fetch(secondCover)).rejects.toThrow();
        expect(restored.online).toBe(false);
        await restored.clear();
        await expect(
          Book.open(url, { offline: restored, fetch: transport.fetch }),
        ).rejects.toBeInstanceOf(OfflineMissError);
      } finally {
        restored.destroy();
      }
    } finally {
      store.destroy();
      container.remove();
      await removeOfflineCache(name);
    }
  });
}
