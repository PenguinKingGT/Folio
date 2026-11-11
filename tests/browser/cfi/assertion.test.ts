/** Native CFI assertion recovery rejects ambiguous matches rather than moving to unrelated text. */
import { expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import { fixture } from './fixture';

test('verifies exact context and uniquely repairs shifted offsets', () => {
  const document = fixture('<p id="para">prefix hello world!</p>');
  const template = 'epubcfi(/6/2!/4/2[para]/1:0[hello ,world])';
  expect(rangeFromCfi(document, template).startOffset).toBe(13);
  expect(rangeFromCfi(document, template.replace(':0[', ':13[')).startOffset).toBe(13);
  expect(rangeFromCfi(document, 'epubcfi(/6/2!/4/2[para]/1:0[,world])').startOffset).toBe(13);
});

test('decodes escaped literal punctuation and supports before-only assertions', () => {
  const document = fixture('<p id="para">a,b</p>');
  expect(rangeFromCfi(document, 'epubcfi(/6/2!/4/2[para]/1:0[a^,,b])').startOffset).toBe(2);
  expect(rangeFromCfi(document, 'epubcfi(/6/2!/4/2[para]/1:0[a^,])').startOffset).toBe(2);
});

test.each(['no matching context', 'hello world hello world'])(
  'rejects unresolved context in %s',
  (text) => {
    const document = fixture(`<p id="para">${text}</p>`);
    expect(() => rangeFromCfi(document, 'epubcfi(/6/2!/4/2[para]/1:1[hello ,world])')).toThrow(
      'uniquely',
    );
  },
);
