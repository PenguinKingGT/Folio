/** Input identification and decoding tests using original, self-contained data. */
import { expect, test } from 'vitest';
import { resolveInput } from '../../../src/index';

test.each([
  ['book.EPUB?download=1#part', 'epub'],
  ['OPS/package.opf', 'opf'],
  ['manifest.json', 'json'],
  ['/books/alice/', 'directory'],
  ['/books/alice', 'directory'],
])('recognizes %s as %s', (input, type) => {
  expect(resolveInput(input)).toEqual({ type, url: input });
});

test('resolves URLs, accepts explicit types and preserves binary slices', () => {
  expect(resolveInput(new URL('https://example.org/book.epub')).type).toBe('epub');
  expect(resolveInput('download', { type: 'epub', baseUrl: 'https://example.org/' })).toEqual({
    type: 'epub',
    url: 'https://example.org/download',
  });
  const original = new Uint8Array([0, 1, 2, 3]);
  const source = resolveInput(original.subarray(1, 3));
  original.fill(9);
  expect(source).toEqual({ type: 'binary', data: new Uint8Array([1, 2]) });
  expect(resolveInput(new ArrayBuffer(2))).toEqual({ type: 'binary', data: new Uint8Array(2) });
});

test.each(['U Es=', 'UEs', 'UEs=\n'])('decodes Base64 %s', (input) => {
  expect(resolveInput(input, { type: 'base64' })).toEqual({
    type: 'binary',
    data: new Uint8Array([80, 75]),
  });
});

test.each(['', ' ', 'A', '===', 'AA=A', '**', '   \n'])('rejects invalid Base64 %s', (input) => {
  expect(() => resolveInput(input, { type: 'base64' })).toThrow(TypeError);
});

test('rejects empty input, unsafe schemes and incompatible explicit types', () => {
  expect(() => resolveInput(' ')).toThrow(TypeError);
  expect(() => resolveInput('javascript:alert(1)')).toThrow(TypeError);
  expect(() => resolveInput(new ArrayBuffer(0), { type: 'opf' })).toThrow(TypeError);
});
