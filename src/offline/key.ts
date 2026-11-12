/** Partition persistent entries by URL and request identity without storing authentication headers as cache keys. */

/** CacheStorage uses synthetic same-format GET addresses; credentials and headers participate only through SHA-256. */
export async function offlineKey(request: Request): Promise<string> {
  if (request.method !== 'GET') {
    throw new TypeError('Offline publication storage supports GET requests only.');
  }
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'blob:') {
    throw new TypeError('Unsupported offline resource protocol.');
  }
  url.hash = '';
  const headers: [string, string][] = [];
  request.headers.forEach((value, key) => headers.push([key, value]));
  const identity = JSON.stringify([url.href, request.credentials, request.mode, headers]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return `https://folio-cache.invalid/v1/${key}`;
}
