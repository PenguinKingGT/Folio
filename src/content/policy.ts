/** Passive content elements share one policy between rendering and headless text indexing. */
export const passiveBlockedTags: ReadonlySet<string> = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'base',
]);
