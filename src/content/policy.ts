/** Passive content elements share one policy between rendering and headless text indexing. */
export const passiveBlockedTags: ReadonlySet<string> = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'base',
]);

/** Keep native rendering and headless CFI producers aligned on removed elements. */
export function passiveElementRemoved(name: string, httpEquiv: string | null): boolean {
  const local = name.toLowerCase();
  return (
    passiveBlockedTags.has(local) ||
    (local === 'meta' && (httpEquiv ?? '').trim().toLowerCase() === 'refresh')
  );
}
