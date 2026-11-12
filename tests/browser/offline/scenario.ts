/** Real browser offline transitions reopen persisted publications and release native resource URLs. */
import { Book, OfflineStore } from '../../../src/index';

let mounted: { store: OfflineStore; name: string; url: string } | null = null;

/** Persist an original publication while real network access is available. */
export async function prepareOfflineScenario(directory: boolean): Promise<void> {
  const name = directory ? 'e2e-offline-directory' : 'e2e-offline-archive';
  const url = new URL(directory ? '/offline-publication/' : '/offline-book.epub', location.href)
    .href;
  const store = new OfflineStore(name);
  mounted = { store, name, url };
  await store.clear();
  const book = await Book.open(url, { offline: store });
  try {
    await book.section()?.load();
    await book.resources.url('images/cover.jpg');
  } finally {
    book.destroy();
  }
}

/** Expose only the actual store policy so Playwright can wait for native connectivity events. */
export function offlineOnline(): boolean | undefined {
  return mounted?.store.online;
}

/** Recreate the store to prove persistence and render its offline chapter using passive native views. */
export async function readOfflineScenario(): Promise<{
  offline: boolean;
  chapter: boolean;
  cover: boolean;
  passive: boolean;
  revoked: boolean;
}> {
  if (!mounted) {
    throw new Error('Missing persisted offline scenario.');
  }
  mounted.store.destroy();
  const store = new OfflineStore(mounted.name);
  mounted.store = store;
  const book = await Book.open(mounted.url, { offline: store });
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  try {
    const reader = book.renderTo(host);
    await reader.display();
    const cover = await book.resources.url('images/cover.jpg');
    const result = {
      offline: !store.online,
      chapter: reader.getContents()?.body.textContent?.includes('Original chapter') === true,
      cover: (await (await fetch(cover)).text()) === 'original cover bytes',
      passive: reader.frame.getAttribute('sandbox') === 'allow-same-origin',
      revoked: false,
    };
    book.destroy();
    try {
      await fetch(cover);
    } catch {
      result.revoked = true;
    }
    return result;
  } finally {
    book.destroy();
    host.remove();
  }
}

/** Delete the authored test namespace only after network connectivity has been restored. */
export async function disposeOfflineScenario(): Promise<void> {
  if (mounted) {
    await mounted.store.clear();
    mounted.store.destroy();
    mounted = null;
  }
}
