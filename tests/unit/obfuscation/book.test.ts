/** Lock down the public resource-byte boundary for standard font obfuscation in OCF ZIPs. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { ScriptResources } from '../../../src/scripted/resources';
import { encodedFont, fontZip, identifierKey } from './fixture';

test('restores standard-obfuscated font bytes through both direct reads and cached resource URLs', async () => {
  const original = Uint8Array.from({ length: 1200 }, (_, index) => index % 251);
  const encoded = encodedFont(original, identifierKey);
  const publication = await Book.open(fontZip(encoded));
  try {
    expect(await publication.bytes('fonts/original%20wide.ttf')).toEqual(original);
    const url = await publication.resources.url('fonts/original%20wide.ttf');
    expect(new Uint8Array(await (await fetch(url)).arrayBuffer())).toEqual(original);
    expect(await publication.bytes('fonts/original%20wide.ttf')).toEqual(original);
    const scripted = new ScriptResources(publication, new AbortController().signal, 1024 * 1024);
    const embedded = await scripted.url('fonts/original%20wide.ttf', publication.packagePath);
    expect(new Uint8Array(await (await fetch(embedded)).arrayBuffer())).toEqual(original);
    expect(encoded).toEqual(encodedFont(original, identifierKey));
  } finally {
    publication.destroy();
  }
});
