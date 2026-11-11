/** Resolve publication references without allowing URL normalization to hide traversal. */
import { validateArchivePath } from '../archive/path';

/** A decoded container path or a reference that requires no archive lookup. */
export type ResourceAddress =
  | { kind: 'local'; path: string; fragment: string }
  | { kind: 'external' | 'inline' | 'fragment'; url: string };

/**
 * Resolve a URI reference against a decoded container-relative document path.
 * @throws TypeError for unsafe schemes, encoded separators, or traversal outside the container.
 */
export function resolveResource(href: string, base: string): ResourceAddress {
  const reference = href.trim();
  if (reference.startsWith('#') || reference === '') {
    return { kind: 'fragment', url: reference };
  }
  if (/^data:/i.test(reference)) {
    return { kind: 'inline', url: reference };
  }
  if (/^(https?:)?\/\//i.test(reference)) {
    return { kind: 'external', url: reference };
  }
  if (
    /^[a-z][a-z\d+.-]*:/i.test(reference) ||
    reference.startsWith('/') ||
    reference.includes('\\')
  ) {
    throw new TypeError(`Unsafe resource reference: ${reference}`);
  }
  validateArchivePath(base);
  const hash = reference.indexOf('#');
  const fragment = hash === -1 ? '' : reference.slice(hash);
  const path = reference.split(/[?#]/, 1)[0] ?? '';
  if (path === '') {
    return { kind: 'local', path: base, fragment };
  }
  const segments = base.split('/').slice(0, -1);
  for (const encoded of path.split('/')) {
    const segment = decodeURIComponent(encoded);
    if (segment === '..') {
      if (segments.pop() === undefined) {
        throw new TypeError('Resource escapes the container root.');
      }
    } else if (segment !== '' && segment !== '.') {
      if (segment.includes('/') || segment.includes('\\')) {
        throw new TypeError('Encoded path separators are not allowed.');
      }
      segments.push(segment);
    }
  }
  return { kind: 'local', path: validateArchivePath(segments.join('/')), fragment };
}
