/** Upstream #1420: inert empty XHTML subsets should parse while package DTDs and entity-bearing subsets remain rejected. */
import { expect, test } from 'vitest';
import { parseXml } from '../../../src/xml/parse';

for (const declaration of [
  '<!DOCTYPE html[]>',
  '<!DOCTYPE html []>',
  '<!DOCTYPE html [ \r\n\t ] >',
]) {
  test(`accepts inert XHTML declaration ${JSON.stringify(declaration)}`, () => {
    const source = `${declaration}<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original</p></body></html>`;
    expect(parseXml(source, 'xhtml').documentElement?.localName).toBe('html');
  });
}

test.each([
  '<!DOCTYPE html[<!ENTITY unsafe "expanded">]>',
  '<!DOCTYPE html[<!ELEMENT html ANY>]>',
  '<!DOCTYPE html[%unsafe;]>',
])('rejects nonempty subset %s before entity or declaration processing', (declaration) => {
  expect(() => parseXml(`${declaration}<html/>`, 'xhtml')).toThrow('DTD');
});

test('package/container XML still rejects even an inert empty doctype subset', () => {
  expect(() => parseXml('<!DOCTYPE html[]><html/>')).toThrow('DTD');
});
