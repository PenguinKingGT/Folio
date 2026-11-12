/** Typed subscriptions preserve identity, ordering, reentrant once semantics, and terminal cleanup. */
import { expect, expectTypeOf, test } from 'vitest';
import { EventEmitter } from '../../../src/events/emitter';
import { disposeAll, isAbortError } from '../../../src/events/errors';

/** Expose protected publication only for deterministic tests of the real subscription implementation. */
class Counter extends EventEmitter<{ value: number; destroyed: undefined }> {
  /** Deliver one synchronous typed payload. */
  send(value: number): void {
    this.emit('value', value);
  }
  /** Close subscriptions even if final lifecycle delivery throws. */
  close(): void {
    this.finishEvents('destroyed', undefined);
  }
}

test('deduplicates callbacks per event, retains first registration mode, and removes original once identities', () => {
  const emitter = new Counter();
  const seen: number[] = [];
  const listener = (value: number) => seen.push(value);
  const release = emitter.on('value', listener);
  emitter.once('value', listener);
  emitter.send(1);
  emitter.send(2);
  expect(seen).toEqual([1, 2]);
  release();
  release();
  emitter.send(3);
  emitter.once('value', listener);
  emitter.off('value', listener);
  emitter.send(4);
  expect(seen).toEqual([1, 2]);
  emitter.send(5);
  expectTypeOf(
    emitter.on('value', (value) => expectTypeOf(value).toEqualTypeOf<number>()),
  ).toEqualTypeOf<() => void>();
});

test('once removes before recursive dispatch and removal/replacement invalidates the current snapshot', () => {
  const emitter = new Counter();
  const seen: string[] = [];
  const later = () => seen.push('later');
  emitter.once('value', () => {
    seen.push('once');
    emitter.send(2);
  });
  emitter.on('value', () => {
    seen.push('first');
    emitter.off('value', later);
    emitter.on('value', later);
  });
  const oldRelease = emitter.on('value', later);
  emitter.send(1);
  expect(seen).toEqual(['once', 'first', 'first']);
  oldRelease();
  emitter.off('value', later);
  emitter.on('value', later);
  oldRelease();
  emitter.send(3);
  expect(seen).toEqual(['once', 'first', 'first', 'first']);
});

test('additions wait until next dispatch and stale unsubscribe handles cannot remove a newer subscription', () => {
  const emitter = new Counter();
  const seen: number[] = [];
  const later = (value: number) => seen.push(value);
  emitter.once('value', () => {
    emitter.on('value', later);
  });
  emitter.send(1);
  emitter.send(2);
  const release = emitter.on('value', later);
  emitter.off('value', later);
  emitter.on('value', later);
  release();
  emitter.send(3);
  expect(seen).toEqual([2, 3]);
});

test('destruction stops the active dispatch, closes future registrations, and always releases callbacks', () => {
  const emitter = new Counter();
  let final = 0;
  let tail = 0;
  emitter.once('destroyed', () => {
    final += 1;
    throw new Error('subscriber');
  });
  emitter.on('value', () => emitter.close());
  emitter.on('value', () => {
    tail += 1;
  });
  expect(() => emitter.send(1)).toThrow('subscriber');
  emitter.send(2);
  emitter.close();
  expect(final).toBe(1);
  expect(tail).toBe(0);
  expect(() => emitter.on('value', () => {})).toThrow('destroyed');
  expect(() => emitter.once('value', () => {})).toThrow('destroyed');
  emitter.off('value', () => {});
});

test('validates callbacks, preserves synchronous failures, and completes every cleanup before surfacing errors', () => {
  const emitter = new Counter();
  expect(() => {
    Reflect.apply(emitter.on.bind(emitter), emitter, ['value', null]);
  }).toThrow(TypeError);
  emitter.on('value', () => {
    throw new Error('synchronous');
  });
  expect(() => emitter.send(0)).toThrow('synchronous');
  const done: number[] = [];
  expect(() =>
    disposeAll([
      () => {
        throw new Error('cleanup');
      },
      () => {
        done.push(1);
      },
    ]),
  ).toThrow(AggregateError);
  expect(done).toEqual([1]);
  disposeAll([
    () => {
      done.push(2);
    },
  ]);
  expect(isAbortError(new DOMException('cancel', 'AbortError'))).toBe(true);
  for (const value of [null, undefined, 1, 'AbortError', {}, new Error('failure')]) {
    expect(isAbortError(value)).toBe(false);
  }
});
