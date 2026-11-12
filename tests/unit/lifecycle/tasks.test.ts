/** Latest-intent queues follow superseding tasks and cancel observers even when host callbacks ignore their signal. */
import { expect, test } from 'vitest';
import { ThemeTasks } from '../../../src/themes/tasks';
import { disposeAsync, errorAfterCleanup } from '../../../src/async/lifecycle';
import { deferred } from './fixture';

test('queue waits follow superseding intent without awaiting an uncooperative obsolete producer', async () => {
  const tasks = new ThemeTasks();
  const held = deferred<void>();
  const started = deferred<void>();
  const rejected = expect(
    tasks.run(() => {
      started.resolve();
      return held.promise;
    }),
  ).rejects.toThrow();
  await started.promise;
  const idle = tasks.whenIdle();
  let completed = false;
  await tasks.run(() => {
    completed = true;
    return Promise.resolve();
  });
  await rejected;
  await idle;
  expect(completed).toBe(true);
  expect(tasks.version).toBe(2);
  held.resolve();
  tasks.destroy();
});

test('obsolete callbacks do not start and synchronous failures remain promised/observable', async () => {
  const tasks = new ThemeTasks();
  let obsolete = false;
  const rejected = expect(
    tasks.run(() => {
      obsolete = true;
      return Promise.resolve();
    }),
  ).rejects.toThrow();
  await tasks.run(() => Promise.resolve());
  await rejected;
  expect(obsolete).toBe(false);
  const failure = new Error('Original task');
  await expect(
    tasks.run(() => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  await expect(tasks.whenIdle()).rejects.toBe(failure);
  await tasks.settled();
  tasks.destroy();
});

test('destruction cancels current waits and closes future queue submissions', async () => {
  const tasks = new ThemeTasks();
  const held = deferred<void>();
  const started = deferred<void>();
  const rejected = expect(
    tasks.run(() => {
      started.resolve();
      return held.promise;
    }),
  ).rejects.toThrow();
  await started.promise;
  tasks.destroy();
  await rejected;
  await expect(tasks.whenIdle()).rejects.toThrow();
  await tasks.settled();
  await expect(tasks.run(() => Promise.resolve())).rejects.toThrow('destroyed');
  held.resolve();
});

test('asynchronous cleanup retains every phase error and operation failures retain failed cleanup causes', async () => {
  const first = new Error('First phase');
  const second = new Error('Second phase');
  let completed = false;
  let failure: unknown;
  try {
    await disposeAsync([
      () => {
        throw first;
      },
      () => Promise.reject(second),
      () => {
        completed = true;
      },
    ]);
  } catch (error) {
    failure = error;
  }
  expect(completed).toBe(true);
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error('Missing aggregate cleanup error.');
  }
  expect(failure.errors).toEqual([first, second]);
  await disposeAsync([() => Promise.resolve()]);
  expect(errorAfterCleanup(first, () => {})).toBe(first);
  const aggregate = errorAfterCleanup(first, () => {
    throw second;
  });
  expect(aggregate).toBeInstanceOf(AggregateError);
  if (!(aggregate instanceof AggregateError)) {
    throw new Error('Missing original cleanup failure.');
  }
  expect(aggregate.errors).toEqual([first, second]);
  expect(aggregate.cause).toBe(first);
});
