/** A distant continuous destination survives obsolete producer completion and asynchronous predecessor measurements. */
import { expect, test } from 'vitest';
import { lateNavigation } from './late-navigation';

test('retains the explicit chapter after old loading and both predecessor expansion and shrinkage', async () => {
  expect(await lateNavigation()).toEqual({
    cancelled: true,
    section: 8,
    retained: true,
    measured: true,
    bounded: true,
    error: false,
  });
});
