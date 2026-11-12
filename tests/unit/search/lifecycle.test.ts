/** Search consumers cancel independently and cannot survive terminal chapter unload/destruction as stale work. */
import { expect, test } from 'vitest';
import { parsePackage, Spine } from '../../../src/index';
import { opf } from '../package/fixture';
import { searchChapter } from './fixture';

/** One uncooperative producer exposes deterministic start and completion gates. */
function heldChapter() {
  let begin: (() => void) | undefined;
  let finish: ((source: string) => void) | undefined;
  let calls = 0;
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const spine = new Spine(parsePackage(opf()), () => {
    calls += 1;
    if (calls > 1) {
      return Promise.resolve(searchChapter.replace('Alpha', 'Fresh'));
    }
    begin?.();
    return pending;
  });
  const section = spine.get();
  if (!section) {
    throw new Error('Missing gated search section.');
  }
  return { spine, section, started, calls: () => calls, release: () => finish?.(searchChapter) };
}

test('one search can cancel while another shares the chapter producer', async () => {
  const { spine, section, started, calls, release } = heldChapter();
  try {
    const controller = new AbortController();
    const rejected = expect(
      section.search('original text', { signal: controller.signal }),
    ).rejects.toThrow();
    const active = section.search('one two three');
    await started;
    controller.abort();
    await rejected;
    release();
    expect(await active).toHaveLength(1);
    expect(calls()).toBe(1);
  } finally {
    release();
    spine.destroy();
  }
});

for (const action of ['unload', 'destroy'] as const) {
  test(`cancels waits when ${action} invalidates an uncooperative chapter producer`, async () => {
    const { spine, section, started, release } = heldChapter();
    let outcome = 'pending';
    const operation = section.search('original').then(
      () => {
        outcome = 'resolved';
      },
      () => {
        outcome = 'rejected';
      },
    );
    try {
      await started;
      section[action]();
      // The next event-loop turn observes all cancellation microtasks without releasing the held producer.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(outcome).toBe('rejected');
      if (action === 'unload') {
        expect(await section.search('Fresh original')).toHaveLength(1);
      }
    } finally {
      release();
      await operation;
      spine.destroy();
    }
  });
}

test('a cached-document search cannot publish results after its generation is unloaded', async () => {
  const { spine, section, release } = heldChapter();
  try {
    release();
    await section.search('original');
    const pending = section.search('original');
    section.unload();
    await expect(pending).rejects.toThrow('unload');
    expect(await section.search('Fresh original')).toHaveLength(1);
  } finally {
    release();
    spine.destroy();
  }
});
