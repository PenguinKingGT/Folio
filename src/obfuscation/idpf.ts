/** Derive the standard EPUB font key and restore only the obfuscated prefix without mutating input. */
import { parseXml, children } from '../xml/parse';
import { dcNamespace, opfNamespace } from '../package/helpers';

/**
 * Hash the package's raw unique identifier after removing only XML whitespace.
 * @throws TypeError for an unresolved identifier or unavailable Web Crypto SHA-1 support.
 * @see https://www.w3.org/TR/epub-33/#obfus-keygen
 */
export async function idpfKey(source: string): Promise<Uint8Array> {
  const root = parseXml(source).documentElement;
  if (root?.namespaceURI !== opfNamespace || root.localName !== 'package') {
    throw new TypeError('Font obfuscation requires a package unique identifier.');
  }
  const id = root.getAttribute('unique-identifier');
  const metadata = children(root, 'metadata', opfNamespace)[0];
  const identifiers = metadata === undefined ? [] : children(metadata, 'identifier', dcNamespace);
  const identifier = identifiers.find((entry) => entry.getAttribute('id') === id);
  // Unicode trim() would also remove NBSP, producing the wrong key for a valid identifier.
  const value = (identifier?.textContent ?? '').replace(/[\u0020\t\r\n]/g, '');
  if (value === '') {
    throw new TypeError('Font obfuscation requires a resolved package unique identifier.');
  }
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new TypeError('IDPF font obfuscation requires Web Crypto SHA-1 support.');
  }
  return new Uint8Array(await subtle.digest('SHA-1', new TextEncoder().encode(value)));
}

/**
 * Return a new font buffer with the first 1040 bytes XORed with the repeating 20-byte key.
 * @throws TypeError when the key is not a SHA-1 digest; the source buffer is never modified.
 */
export function restoreIdpfFont(bytes: Uint8Array, key: Uint8Array): Uint8Array<ArrayBuffer> {
  if (key.length !== 20) {
    throw new TypeError('An IDPF font key must contain exactly 20 bytes.');
  }
  const mask = new DataView(key.buffer, key.byteOffset, key.byteLength);
  // Copy natively; JavaScript must not visit the potentially multi-megabyte unchanged tail.
  const restored = new Uint8Array(bytes);
  const prefix = restored.subarray(0, 1040);
  prefix.forEach((byte, index) => {
    prefix[index] = byte ^ mask.getUint8(index % 20);
  });
  return restored;
}
