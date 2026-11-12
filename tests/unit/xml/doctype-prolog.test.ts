/** Inert-doctype normalization is restricted to the prolog and never rewrites comments, body literals, or active subsets. */
import { expect, test } from 'vitest';
import { normalizeEmptyDoctype } from '../../../src/xml/empty-doctype';
import { parseXml } from '../../../src/xml/parse';

for (const prefix of [
  '',
  '\ufeff',
  ' \t\r\n',
  '<?xml version="1.0"?>\n',
  '<!-- Original -->\n',
  '<?original value?>\n',
  '<?xml version="1.0"?><!-- Original --><?original value?>\n',
]) {
  test(`normalizes only the actual prolog declaration after ${JSON.stringify(prefix)}`, () => {
    const body = '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>Original</body></html>';
    expect(normalizeEmptyDoctype(`${prefix}<!DOCTYPE html[]>${body}`)).toBe(
      `${prefix}<!DOCTYPE html>${body}`,
    );
    expect(parseXml(`${prefix}<!DOCTYPE html[]>${body}`, 'xhtml').documentElement?.localName).toBe(
      'html',
    );
  });
}

test.each([
  '',
  ' \t\r\n',
  '<!-- Original -->',
  '<?original value?>',
  '<!-- not closed <!DOCTYPE html[]>',
  '<?notclosed <!DOCTYPE html[]>',
  '<html><![CDATA[<!DOCTYPE html[]>]]></html>',
  '<!-- <!DOCTYPE html[]> --><html/>',
  '<html><!DOCTYPE html[]></html>',
  '<!DOCTYPE other[]><html/>',
  '<!DOCTYPE html[<!ENTITY bad "value">]><html/>',
  '<!DOCTYPE html SYSTEM "original.dtd"[]><html/>',
  '<!DOCTYPE html\u00a0[]><html/>',
])('does not rewrite unsupported or non-prolog text %s', (source) => {
  expect(normalizeEmptyDoctype(source)).toBe(source);
});

test('duplicate declarations and nonempty subsets remain rejected after an inert declaration', () => {
  const root = '<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>';
  expect(() => parseXml(`<!DOCTYPE html[]><!DOCTYPE html[]>${root}`, 'xhtml')).toThrow();
  expect(() =>
    parseXml(`<!DOCTYPE html[]><!DOCTYPE html SYSTEM "original.dtd">${root}`, 'xhtml'),
  ).toThrow();
  expect(() => parseXml(`<!DOCTYPE html[]><!ENTITY bad "expanded">${root}`, 'xhtml')).toThrow(
    'DTD',
  );
});

test('consumes one leading decoded byte-order mark while preserving body characters', () => {
  expect(parseXml('\ufeff<root>\ufeffOriginal</root>').documentElement?.textContent).toBe(
    '\ufeffOriginal',
  );
  expect(() => parseXml('\ufeff\ufeff<root/>')).toThrow('XML');
});
