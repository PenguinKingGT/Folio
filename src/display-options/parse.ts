/** Parse legacy Apple display-options XML with deterministic wildcard/platform precedence. */
import type { Element } from '@xmldom/xmldom';
import { parseXml } from '../xml/parse';
import type { AppleDisplayOptions, ApplePlatform } from './types';

/** Select only direct unnamespaced legacy elements rather than flattening unrelated nested metadata. */
function children(parent: Element, name: string): Element[] {
  return Array.from(parent.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && node.localName === name && !node.namespaceURI,
  );
}

/** Parse only documented boolean spellings, preserving explicit false instead of defaulting by truthiness. */
function boolean(value: string): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new TypeError('Apple display booleans must be true or false.');
}

/** Validate known option values and ignore unrelated vendor additions without interpreting executable behavior. */
function options(element: Element): Partial<AppleDisplayOptions> {
  const result: {
    fixedLayout?: boolean;
    openToSpread?: boolean;
    interactive?: boolean;
    orientationLock?: AppleDisplayOptions['orientationLock'];
  } = {};
  const names = new Set<string>();
  for (const option of children(element, 'option')) {
    const name = option.getAttribute('name');
    const value = (option.textContent ?? '').trim();
    if (name === null || name.trim() === '') {
      throw new TypeError('Display options require names.');
    }
    if (!['fixed-layout', 'open-to-spread', 'interactive', 'orientation-lock'].includes(name)) {
      continue;
    }
    if (names.has(name)) {
      throw new TypeError(`Duplicate Apple display option: ${name}`);
    }
    names.add(name);
    if (name === 'fixed-layout') {
      result.fixedLayout = boolean(value);
    } else if (name === 'open-to-spread') {
      result.openToSpread = boolean(value);
    } else if (name === 'interactive') {
      result.interactive = boolean(value);
    } else if (name === 'orientation-lock') {
      if (value !== 'none' && value !== 'portrait-only' && value !== 'landscape-only') {
        throw new TypeError('Unsupported Apple orientation-lock value.');
      }
      result.orientationLock = value;
    }
  }
  return result;
}

/** Wildcard options apply before an explicitly selected platform, independent of XML element order. */
export function parseAppleDisplayOptions(
  source: string,
  platform: ApplePlatform = '*',
): AppleDisplayOptions {
  if (!['*', 'ipad', 'iphone'].includes(platform)) {
    throw new TypeError('Unsupported Apple platform.');
  }
  const root = parseXml(source).documentElement;
  if (root?.localName !== 'display_options' || root.namespaceURI) {
    throw new TypeError('Expected an Apple display_options root.');
  }
  const platforms = new Map<string, Partial<AppleDisplayOptions>>();
  for (const entry of children(root, 'platform')) {
    const name = entry.getAttribute('name') ?? 'iphone';
    if (name !== '*' && name !== platform) {
      continue;
    }
    if (platforms.has(name)) {
      throw new TypeError(`Duplicate Apple platform: ${name}`);
    }
    platforms.set(name, options(entry));
  }
  return Object.freeze({
    fixedLayout: null,
    openToSpread: null,
    interactive: null,
    orientationLock: null,
    ...options(root),
    ...platforms.get('*'),
    ...(platform === '*' ? {} : platforms.get(platform)),
  });
}
