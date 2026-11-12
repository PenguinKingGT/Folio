/** Extension pipelines await stable ordered snapshots and race independently owned cancellation signals. */
import { expect, test } from 'vitest';
import { AsyncHook } from '../../../src/index';

import { gate } from './fixture';

/** Stable callback identities exercise deduplication and removal independently of closures. */
function recordSecond(events: string[]): void {
  events.push('second');
}
/** Record a reusable original callback without closing over test-local state. */
function recordOriginal(events: string[]): void {
  events.push('original');
}
/** Supply a shared registration identity for capacity validation. */
function noop(): void {}

test('awaits registration order and retains one snapshot across callback registration changes', async () => {
  const hook = new AsyncHook<string[]>();
  const waiting = gate();
  const started = gate();
  const second = recordSecond;
  hook.register(async (events) => {
    events.push('start');
    started.release();
    await waiting.promise;
    events.push('finish');
  });
  hook.register(second);
  const events: string[] = [];
  const operation = hook.run(events);
  await started.promise;
  hook.unregister(second);
  hook.register((entries) => {
    entries.push('later');
  });
  expect(events).toEqual(['start']);
  waiting.release();
  await operation;
  expect(events).toEqual(['start', 'finish', 'second']);
  await hook.run(events);
  expect(events.slice(-3)).toEqual(['start', 'finish', 'later']);
  hook.destroy();
});

test('deduplicates callback identities and stale removal cannot delete a newer registration', async () => {
  const hook = new AsyncHook<string[]>();
  const callback = recordOriginal;
  const oldRelease = hook.register(callback);
  hook.register(callback);
  const events: string[] = [];
  await hook.run(events);
  expect(events).toEqual(['original']);
  hook.unregister(callback);
  const release = hook.register(callback);
  oldRelease();
  await hook.run(events);
  expect(events).toHaveLength(2);
  release();
  release();
  hook.clear();
  await hook.run(events);
  expect(events).toHaveLength(2);
});

test('validates callback inputs and bounds distinct registrations without rejecting duplicates at capacity', () => {
  const hook = new AsyncHook<void>();
  expect(() => {
    Reflect.apply(hook.register.bind(hook), hook, [null]);
  }).toThrow(TypeError);
  const callback = noop;
  hook.register(callback);
  for (let index = 1; index < 128; index += 1) {
    hook.register(() => {});
  }
  expect(() => hook.register(callback)).not.toThrow();
  expect(() => hook.register(() => {})).toThrow('Too many');
  hook.destroy();
  hook.destroy();
  expect(() => hook.register(callback)).toThrow();
  hook.unregister(callback);
});

test('pre-abort and abort before callback scheduling prevent side effects', async () => {
  const hook = new AsyncHook<void>();
  let calls = 0;
  hook.register(() => {
    calls += 1;
  });
  const controller = new AbortController();
  const operation = hook.run(undefined, controller.signal);
  controller.abort();
  await expect(operation).rejects.toThrow();
  await expect(hook.run(undefined, controller.signal)).rejects.toThrow();
  expect(calls).toBe(0);
  hook.destroy();
});

for (const action of ['abort', 'destroy'] as const) {
  test(`${action} promptly rejects a running wait while preserving independent consumers`, async () => {
    const hook = new AsyncHook<string>();
    const waiting = gate();
    const started = gate();
    const completed: string[] = [];
    hook.register(async (value, signal) => {
      if (value === 'held') {
        started.release();
        await waiting.promise;
      }
      signal.throwIfAborted();
      completed.push(value);
    });
    const controller = new AbortController();
    const rejected = expect(hook.run('held', controller.signal)).rejects.toThrow();
    await started.promise;
    await hook.run('independent');
    if (action === 'abort') {
      controller.abort();
    } else {
      hook.destroy();
    }
    await rejected;
    waiting.release();
    expect(completed).toEqual(['independent']);
    hook.destroy();
  });
}

test('errors stop subsequent callbacks and preserve the original rejection', async () => {
  const hook = new AsyncHook<void>();
  const failure = new Error('original extension');
  let later = false;
  hook.register(() => {
    throw failure;
  });
  hook.register(() => {
    later = true;
  });
  await expect(hook.run(undefined)).rejects.toBe(failure);
  expect(later).toBe(false);
  hook.destroy();
});
