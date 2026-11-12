/** Native passive preparation normalizes only inert XHTML empty subsets before the browser XML parser sees them. */
import { expect, test } from 'vitest';
import { prepareContent } from '../../../src/render/content';

test('prepares compact empty XHTML declarations without a browser parser-error document', () => {
  const result = prepareContent(
    '<?xml version="1.0"?><!DOCTYPE html[]><html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original inert subset</p></body></html>',
    'empty-subset',
  );
  expect(result).toContain('Original inert subset');
  expect(result).not.toContain('parsererror');
  expect(result).not.toContain('html[]');
});

for (const scripted of [false, true]) {
  test(`${scripted ? 'scripted' : 'passive'} complete book accepts only the inert empty subset and preserves isolation`, async () => {
    const { inertDoctype } = await import('./inert-doctype');
    expect(await inertDoctype(scripted)).toEqual({ readable: true, isolated: true });
  });
}
