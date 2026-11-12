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

/** Return only recognized IDPF font targets; unrelated encryption algorithms remain unsupported and untouched. */
export function obfuscatedFonts(
  source: string,
  publication: PublicationPackage,
  packagePath: string,
): ReadonlySet<string> {
  const root = parseXml(source).documentElement;
  if (root?.localName !== 'encryption' || root.namespaceURI !== container) {
    throw new TypeError('Expected an OCF encryption document.');
  }
  const fonts = new Set<string>();
  for (const item of publication.manifest.values()) {
    if (fontTypes.includes(item.mediaType.toLowerCase())) {
      const address = resolveResource(item.href, packagePath);
      if (address.kind === 'local') {
        fonts.add(address.path);
      }
    }
  }
  const targets = new Set<string>();
  for (const entry of children(root, 'EncryptedData', encryption)) {
    const methods = children(entry, 'EncryptionMethod', encryption);
    if (!methods.some((method) => method.getAttribute('Algorithm') === algorithm)) {
      continue;
    }
    child(entry, 'EncryptionMethod');
    const path = fontPath(entry);
    if (!fonts.has(path) || targets.has(path)) {
      throw new TypeError('Obfuscation must reference distinct manifest font resources.');
    }
    targets.add(path);
  }
  return targets;
}
