/** Archive paths are container-relative literal filenames, not URLs. */

/** Reject traversal, absolute paths, backslashes, and ambiguous path segments. */
export function validateArchivePath(path: string): string {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    /[\\:]/.test(path) ||
    Array.from(path).some((character) => character.charCodeAt(0) < 32) ||
    path.split('/').some((segment) => segment === '..' || segment === '.')
  ) {
    throw new TypeError(`Unsafe archive path: ${path}`);
  }
  return path;
}
