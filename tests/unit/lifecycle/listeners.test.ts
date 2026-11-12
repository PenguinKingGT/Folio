/** Clearing subscriptions invalidates active snapshots and obsolete unsubscribe handles. */
import { expect, test } from 'vitest';
import { Listeners } from '../../../src/events/listeners';

test('clear terminates the current notification snapshot', () => {
  const listeners = new Listeners<number>();
  const values: number[] = [];
  listeners.subscribe((value) => {
    values.push(value);
    listeners.clear();
  });
  listeners.subscribe((value) => values.push(value + 1));
  listeners.emit(2);
  expect(values).toEqual([2]);
});

test('obsolete unsubscribe handles cannot remove subscriptions registered after clear', () => {
  const listeners = new Listeners<number>();
  const values: number[] = [];
  const listener = (value: number): void => {
    values.push(value);
  };
  const unsubscribe = listeners.subscribe(listener);
  listeners.clear();
  listeners.subscribe(listener);
  unsubscribe();
  listeners.emit(3);
  expect(values).toEqual([3]);
});
