/** Position ordering must be numerical, assertion-independent, and consistent for ranges. */
import { expect, test } from 'vitest';
import { Cfi } from '../../../src/index';

test.each([
  ['epubcfi(/6/2!/4/2/1:2)', 'epubcfi(/6/2!/4/2/1:10)'],
  ['epubcfi(/6/2!/4/2/1:0)', 'epubcfi(/6/10!/4/2/1:0)'],
  ['epubcfi(/6/2!/4/2)', 'epubcfi(/6/2!/4/2/2)'],
  ['epubcfi(/6/2)', 'epubcfi(/6/2!/4/2)'],
  ['epubcfi(/6/2!/4/2,/1:0,/1:10)', 'epubcfi(/6/2!/4/2/1:1)'],
])('sorts %s before %s', (left, right) => {
  expect(new Cfi(left).compare(right)).toBe(-1);
  expect(new Cfi(right).compare(new Cfi(left))).toBe(1);
});

test('ignores ID/text assertions and treats omitted offsets as zero', () => {
  expect(
    new Cfi('epubcfi(/6/2[a]!/4/2/1:0[before,after])').compare('epubcfi(/6/2[b]!/4/2/1:0)'),
  ).toBe(0);
  expect(new Cfi('epubcfi(/6/2!/4/2/1)').compare('epubcfi(/6/2!/4/2/1:0)')).toBe(0);
});
