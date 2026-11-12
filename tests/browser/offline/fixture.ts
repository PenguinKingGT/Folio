/** Offline integration fixtures serve original publication bytes through the standard Fetch boundary. */
import { bookFiles, bookZip } from '../../unit/book/fixture';

/** Serve either a complete archive or decoded directory resources and retain exact request counts. */
export function offlineTransport(): { fetch: typeof fetch; count: () => number; fail: () => void } {
  const files = bookFiles();
  let calls = 0;
  let failed = false;
  return {
    count: () => calls,
    fail: () => {
      failed = true;
    },
    fetch: (input) => {
      calls += 1;
      if (failed) {
        return Promise.reject(new TypeError('Original offline network'));
      }
      const request = new Request(input);
      if (request.url.endsWith('.epub')) {
        return Promise.resolve(new Response(Uint8Array.from(bookZip(files))));
      }
      const path = decodeURIComponent(new URL(request.url).pathname.replace('/publication/', ''));
      const source = files.get(path);
      return Promise.resolve(
        new Response(source ?? 'missing', { status: source === undefined ? 404 : 200 }),
      );
    },
  };
}

/** Remove only the named authored-test cache, including cleanup after the store itself was destroyed. */
export async function removeOfflineCache(name: string): Promise<void> {
  await caches.delete(`folio-offline-v1:${name}`);
}
