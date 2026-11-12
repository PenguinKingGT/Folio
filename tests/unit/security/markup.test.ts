/** Network publication markup rejects invalid UTF-8 and entity expansion before constructing a book. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { parseXml } from '../../../src/xml/parse';
import { validateXmlSource } from '../../../src/xml/constraints';
import { bookFiles } from '../book/fixture';

for (const input of [
  'https://original.invalid/book/',
  'https://original.invalid/book.opf',
  'https://original.invalid/book.json',
]) {
  test(`rejects invalid UTF-8 publication source ${input}`, async () => {
    await expect(
      Book.open(input, {
        fetch: () => Promise.resolve(new Response(new Uint8Array([0xc3, 0x28]))),
      }),
    ).rejects.toThrow(TypeError);
  });
}

test('also rejects an invalid package after successful container discovery', async () => {
  const container = bookFiles().get('META-INF/container.xml');
  await expect(
    Book.open('https://original.invalid/book/', {
      fetch: (input) =>
        Promise.resolve(
          new Response(
            (input instanceof Request ? input.url : input.toString()).endsWith('container.xml')
              ? container
              : new Uint8Array([0xff]),
          ),
        ),
    }),
  ).rejects.toThrow(TypeError);
});

test.each([
  '<!DOCTYPE html [<!ENTITY bomb "expanded">]><html/>',
  '<!ENTITY bomb "expanded"><html/>',
])('rejects untrusted entity declarations %s', (source) => {
  expect(() => parseXml(source, 'xhtml')).toThrow('DTD');
});

test('external XHTML declarations remain inert while XML package DTDs are rejected', () => {
  const source = '<!DOCTYPE html SYSTEM "https://blocked.invalid/external.dtd"><html/>';
  expect(parseXml(source, 'xhtml').documentElement?.localName).toBe('html');
  expect(() => parseXml(source)).toThrow('DTD');
  expect(() => validateXmlSource('x'.repeat(5 * 1024 * 1024 + 1), 'xhtml')).toThrow(RangeError);
  expect(() => {
    Reflect.apply(validateXmlSource, undefined, [null, 'xml']);
  }).toThrow(RangeError);
});
