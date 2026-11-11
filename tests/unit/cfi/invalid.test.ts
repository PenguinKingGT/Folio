/** Reject malformed, ambiguous, overflowing, and unsupported text CFI positions. */
import { expect, test } from 'vitest';
import { Cfi } from '../../../src/index';

test.each([
  '',
  '/6/2!/4',
  'epubcfi(/6/2!/4',
  'epubcfi()',
  'epubcfi(/0)',
  'epubcfi(/02)',
  'epubcfi(/9007199254740992)',
  'epubcfi(/6/2!/4/1/2)',
  'epubcfi(/6/2!/4:1:2)',
  'epubcfi(/6/2!/4/1:-1)',
  'epubcfi(/6/2!/4/1:01)',
  'epubcfi(/6/2!/4/1~2)',
  'epubcfi(/6/2!/4/2@50:50)',
  'epubcfi(/6/2[id^x]!/4)',
  'epubcfi(/6/2[id^)',
  'epubcfi(/6/2[id]!/4])',
  'epubcfi(/6/2[[id]]!/4)',
  'epubcfi(/6/2[id!/4)',
  'epubcfi(/6/2[raw(parenthesis)]!/4)',
  'epubcfi(/6/2!/4,,/2)',
  'epubcfi(/6/2!/4,/2)',
  'epubcfi(/6/2!/4:0,/1:0,/1:2)',
  'epubcfi(/6/2:0!/4)',
  'epubcfi(/6/2!/4/2,/1:10,/1:0)',
  'epubcfi(/6/2!/4/1,/2:0,/2:1)',
  'epubcfi(/6/2!/4/2,/1:0,/1:1,extra)',
])('rejects invalid CFI %#', (source) => {
  expect(() => new Cfi(source)).toThrow(TypeError);
});

test('bounds input length before parsing', () => {
  expect(() => new Cfi(`epubcfi(/6/2[${'x'.repeat(16_384)}]!/4)`)).toThrow(TypeError);
});
