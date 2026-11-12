/** Validate standard obfuscation records against local manifest fonts and container-safe paths. */
import type { Element } from '@xmldom/xmldom';
import type { PublicationPackage } from '../package/types';
import { requiredAttribute } from '../package/helpers';
import { parseXml, children } from '../xml/parse';
import { resolveResource } from '../resources/path';

const container = 'urn:oasis:names:tc:opendocument:xmlns:container';
const encryption = 'http://www.w3.org/2001/04/xmlenc#';
const algorithm = 'http://www.idpf.org/2008/embedding';
const fontTypes = [
  'font/otf',
  'font/ttf',
  'font/woff',
  'font/woff2',
  'application/vnd.ms-opentype',
  'application/font-sfnt',
  'application/font-woff',
];

/** Require one direct encryption child rather than matching nested or foreign-namespace elements. */
function child(parent: Element, name: string): Element {
  const entries = children(parent, name, encryption);
  const result = entries[0];
  if (entries.length !== 1 || result === undefined) {
    throw new TypeError(`Font obfuscation requires exactly one ${name}.`);
  }
  return result;
}

/** META-INF URI values are relative to the container root, not to META-INF or the OPF directory. */
function fontPath(entry: Element): string {
  const uri = requiredAttribute(child(child(entry, 'CipherData'), 'CipherReference'), 'URI');
  const address = resolveResource(uri, 'encryption.xml');
  if (address.kind !== 'local' || address.fragment !== '' || uri.includes('?')) {
    throw new TypeError(
      'Obfuscated fonts require local container paths without queries or fragments.',
    );
  }
  return address.path;
}

/** Select IDPF fonts owned by this rendition; container records for other renditions remain untouched. */
export function obfuscatedFonts(
  source: string,
  publication: PublicationPackage,
  packagePath: string,
): ReadonlySet<string> {
  const root = parseXml(source).documentElement;
  if (root?.localName !== 'encryption' || root.namespaceURI !== container) {
    throw new TypeError('Expected an OCF encryption document.');
  }
  const resources = new Map<string, string>();
  for (const item of publication.manifest.values()) {
    const address = resolveResource(item.href, packagePath);
    if (address.kind === 'local') {
      resources.set(address.path, item.mediaType);
    }
  }
  const seen = new Set<string>();
  const targets = new Set<string>();
  for (const entry of children(root, 'EncryptedData', encryption)) {
    const methods = children(entry, 'EncryptionMethod', encryption);
    if (!methods.some((method) => method.getAttribute('Algorithm') === algorithm)) {
      continue;
    }
    child(entry, 'EncryptionMethod');
    const path = fontPath(entry);
    if (seen.has(path)) {
      throw new TypeError('Obfuscation must reference distinct container resources.');
    }
    seen.add(path);
    // Encryption metadata belongs to the container, while this manifest and key belong to one rendition.
    const type = resources.get(path);
    if (type === undefined) {
      continue;
    }
    if (!fontTypes.includes(type.toLowerCase())) {
      throw new TypeError('Obfuscation must reference manifest font resources.');
    }
    targets.add(path);
  }
  return targets;
}
