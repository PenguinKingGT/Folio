/** Original OCF fixtures cover namespaces, rendition ordering, and invalid documents. */
import { expect, test } from 'vitest';
import { parseContainer } from '../../../src/index';

const namespace = 'urn:oasis:names:tc:opendocument:xmlns:container';
const mediaType = 'application/oebps-package+xml';

/** Wrap original rootfile entries in a valid OCF document. */
function container(entries: string): string {
  return `<container xmlns="${namespace}" version="1.0"><rootfiles>${entries}</rootfiles></container>`;
}

/** Build a package entry with an optionally overridden media type. */
function entry(path: string, type = mediaType): string {
  return `<rootfile full-path="${path}" media-type="${type}"/>`;
}

test('uses the first OPF rendition relative to the container root', () => {
  expect(
    parseContainer(
      container(entry('preview.pdf', 'application/pdf') + entry('OPS/书.opf') + entry('other.opf')),
    ),
  ).toEqual({
    packagePath: 'OPS/书.opf',
    directory: 'OPS/',
    rootfiles: ['OPS/书.opf', 'other.opf'],
  });
  expect(parseContainer(container(entry('book.opf'))).directory).toBe('');
});

test('accepts namespace prefixes, comments, whitespace and XML declarations', () => {
  const xml = `<?xml version="1.0"?><c:container xmlns:c="${namespace}">
    <!-- Original fixture. --><c:rootfiles><c:rootfile full-path="OPS/book.opf" media-type="${mediaType}"/></c:rootfiles>
  </c:container>`;
  expect(parseContainer(xml).packagePath).toBe('OPS/book.opf');
});

test.each([
  '',
  '<broken>',
  '<a><b></a>',
  '<root/>',
  '<container/>',
  `<container xmlns="${namespace}"/>`,
  `<container xmlns="${namespace}"><rootfiles/><rootfiles/></container>`,
  container(''),
  container(entry('book.pdf', 'application/pdf')),
  container('<rootfile media-type="application/oebps-package+xml"/>'),
  container(entry('OPS/')),
  container(entry('../book.opf')),
  container(entry('/book.opf')),
  container(entry('https://example.org/book.opf')),
  '<!DOCTYPE container><container/>',
  '<!ENTITY example "bad"><container/>',
])('rejects invalid container %s', (xml) => {
  expect(() => parseContainer(xml)).toThrow();
});

test('ignores nested or foreign-namespace rootfiles', () => {
  expect(() =>
    parseContainer(
      `<container xmlns="${namespace}"><wrapper><rootfiles>${entry('book.opf')}</rootfiles></wrapper></container>`,
    ),
  ).toThrow();
  expect(() =>
    parseContainer(container('<rootfile xmlns="other" full-path="book.opf"/>')),
  ).toThrow();
});

test('rejects excessively large XML before parsing', () => {
  expect(() => parseContainer(' '.repeat(5 * 1024 * 1024 + 1))).toThrow(RangeError);
});
