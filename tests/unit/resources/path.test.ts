/** Original path cases verify URI decoding and container traversal boundaries. */
import { expect, test } from 'vitest';
import { resolveResource } from '../../../src/index';

test.each([
  ['../images/cover%20x.jpg#part', 'OPS/text/chapter.xhtml', 'OPS/images/cover x.jpg', '#part'],
  ['./chapter.xhtml?cache=1', 'OPS/book.opf', 'OPS/chapter.xhtml', ''],
  ['?cache=1#here', 'OPS/chapter.xhtml', 'OPS/chapter.xhtml', '#here'],
  ['../书.xhtml', 'OPS/chapter.xhtml', '书.xhtml', ''],
  ['a//b/./c.css', 'book.opf', 'a/b/c.css', ''],
])('resolves %s from %s', (href, base, path, fragment) => {
  expect(resolveResource(href, base)).toEqual({ kind: 'local', path, fragment });
});

test.each([
  ['#symbol', 'fragment'],
  ['', 'fragment'],
  ['data:image/png;base64,AA==', 'inline'],
  ['https://example.org/image.png', 'external'],
  ['//example.org/image.png', 'external'],
])('preserves %s without archive lookup', (href, kind) => {
  expect(resolveResource(href, 'OPS/book.opf')).toEqual({ kind, url: href });
});

test.each([
  '../../evil',
  '%2e%2e/%2e%2e/evil',
  'a%2fb',
  'a%5cb',
  'a\\b',
  '/absolute',
  'javascript:alert(1)',
  'file:///tmp/x',
  'a%00b',
  '%zz',
])('rejects unsafe reference %s', (href) => {
  expect(() => resolveResource(href, 'OPS/book.opf')).toThrow();
});

test('rejects invalid base paths and empty resolved paths', () => {
  expect(() => resolveResource('image.png', '../book.opf')).toThrow(TypeError);
  expect(() => resolveResource('..', 'OPS/book.opf')).toThrow(TypeError);
});
