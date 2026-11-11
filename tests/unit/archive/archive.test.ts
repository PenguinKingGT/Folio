/** Original ZIP fixtures verify extraction, encoding, MIME, and resource cleanup. */
import { strToU8, zipSync } from 'fflate';
import { expect, test } from 'vitest';
import { Archive } from '../../../src/index';

/** Create a minimal ZIP containing Unicode filenames and multibyte text. */
function fixture(): Uint8Array {
  return zipSync({
    'OPS/': new Uint8Array(),
    'OPS/章节.xhtml': strToU8('<p>你好 EPUB</p>'),
    'OPS/font.woff2': new Uint8Array([0, 1, 255]),
    'large.txt': new Uint8Array(20_000).fill(65),
    'unknown.bin': new Uint8Array([255]),
    'empty.txt': new Uint8Array(),
  });
}

test('reads text, isolated bytes, Base64 and typed blobs', async () => {
  const archive = new Archive(fixture());
  expect(archive.list()).toContain('OPS/章节.xhtml');
  expect(archive.list()).not.toContain('OPS/');
  expect(archive.getText('OPS/章节.xhtml')).toBe('<p>你好 EPUB</p>');
  const bytes = archive.getBytes('OPS/font.woff2');
  bytes.fill(0);
  expect(archive.getBytes('OPS/font.woff2')).toEqual(new Uint8Array([0, 1, 255]));
  expect(archive.getBase64('OPS/font.woff2')).toBe('AAH/');
  expect(atob(archive.getBase64('large.txt')).length).toBe(20_000);
  expect(archive.getBlob('OPS/font.woff2').type).toBe('font/woff2');
  expect(archive.getBlob('unknown.bin').type).toBe('application/octet-stream');
  expect(await archive.getBlob('empty.txt').text()).toBe('');
  archive.destroy();
});

test('caches URLs by MIME and mode and revokes them', async () => {
  const archive = new Archive(new Uint8Array(fixture()).buffer);
  const url = archive.createUrl('OPS/章节.xhtml');
  expect(archive.createUrl('OPS/章节.xhtml')).toBe(url);
  expect(await (await fetch(url)).text()).toBe('<p>你好 EPUB</p>');
  expect(archive.createUrl('OPS/章节.xhtml', { base64: true })).toMatch(
    /^data:application\/xhtml\+xml;base64,/,
  );
  const custom = archive.createUrl('OPS/章节.xhtml', { type: 'text/plain' });
  expect((await fetch(custom)).headers.get('content-type')).toBe('text/plain');
  archive.revokeUrl('OPS/章节.xhtml');
  archive.revokeUrl('OPS/章节.xhtml');
  await expect(fetch(url)).rejects.toThrow();
  await expect(fetch(custom)).rejects.toThrow();
  const replacement = archive.createUrl('empty.txt');
  archive.createUrl('OPS/font.woff2', { base64: true });
  archive.destroy();
  archive.destroy();
  await expect(fetch(replacement)).rejects.toThrow();
  expect(() => archive.list()).toThrow('destroyed');
  expect(() => archive.getText('empty.txt')).toThrow('destroyed');
  expect(() => archive.createUrl('empty.txt')).toThrow('destroyed');
});

test('rejects missing entries, invalid bytes and corrupt archives', () => {
  const archive = new Archive(fixture());
  expect(() => archive.getText('missing')).toThrow(RangeError);
  expect(() => archive.getText('unknown.bin')).toThrow();
  expect(() => new Archive(new Uint8Array([0, 1, 2]))).toThrow();
});

test.each(['../evil', '/evil', 'C:/evil', 'a\\evil', 'a/./evil', 'a/../evil', 'a\0evil'])(
  'rejects unsafe ZIP entry %s',
  (path) => {
    expect(() => new Archive(zipSync({ [path]: strToU8('bad') }))).toThrow('Unsafe archive path');
  },
);

test.each([
  { maxArchiveBytes: 1 },
  { maxEntryBytes: 1 },
  { maxTotalBytes: 1 },
  { maxEntries: 1 },
  { maxArchiveBytes: 0 },
  { maxEntries: -1 },
  { maxEntryBytes: Number.NaN },
])('rejects resource limits %j', (limits) => {
  expect(() => new Archive(fixture(), limits)).toThrow(RangeError);
});

test('accepts an empty valid ZIP and prevents invalid lookup paths', () => {
  expect(new Archive(zipSync({})).list()).toEqual([]);
  expect(() => new Archive(fixture()).getBytes('../evil')).toThrow(TypeError);
});
