/** Continuous notification state deduplicates snapshots and becomes inert after terminal cleanup. */
import { expect, test } from 'vitest';
import { ContinuousEvents } from '../../../src/continuous/events';

test('publishes changed snapshots and retains errors only while notification ownership is active', () => {
  const events = new ContinuousEvents();
  const boundary = {
    cfi: 'epubcfi(/6/2[chapter]!/4)',
    index: 0,
    href: 'chapter.xhtml',
    displayed: { page: 1, total: 1 },
    location: null,
    percentage: null,
  };
  const location = { start: boundary, end: boundary, atStart: true, atEnd: true };
  const reported: string[] = [];
  const errors: unknown[] = [];
  const release = events.relocations.subscribe((snapshot) => reported.push(snapshot.start.cfi));
  events.errors.subscribe((error) => errors.push(error));
  events.report(location);
  events.report(location);
  const error = new Error('Original failure');
  events.fail(error);
  expect(events.lastError).toBe(error);
  expect(reported).toHaveLength(1);
  expect(errors).toEqual([error]);
  release();
  release();
  events.destroy();
  events.destroy();
  events.report({ ...location, atEnd: false });
  events.fail(new Error('Late failure'));
  expect(events.lastError).toBeNull();
  expect(errors).toHaveLength(1);
  expect(reported).toHaveLength(1);
});
