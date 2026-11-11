/** Exercise shared chapter loading, serialization, retries, and cancellation without timers. */
import { expect, test } from 'vitest';
import { parsePackage, Spine } from '../../../src/index';
import type { Section, SectionLoader } from '../../../src/index';
import { opf } from '../package/fixture';

const xhtml =
  '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original</p></body></html>';

/** Create a lazy chapter backed by the supplied producer. */
function section(loader: SectionLoader): Section {
  const result = new Spine(parsePackage(opf()), loader).get();
  if (result === null) {
    throw new Error('Missing fixture chapter.');
  }
  return result;
}

/** Expose a deterministic producer gate without requiring ES2024 library declarations. */
function deferred(): { promise: Promise<string>; resolve: (value: string) => void } {
  let deliver: ((value: string) => void) | undefined;
  const promise = new Promise<string>((resolve) => {
    deliver = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      if (deliver === undefined) {
        throw new Error('Uninitialized gate.');
      }
      deliver(value);
    },
  };
}

test('coalesces loads, caches the DOM, and serializes caller changes', async () => {
  let calls = 0;
  const chapter = section(() => {
    calls += 1;
    return Promise.resolve(xhtml);
  });
  const [first, second] = await Promise.all([chapter.load(), chapter.load()]);
  expect(first).toBe(second);
  first.documentElement?.setAttribute('data-test', 'updated');
  expect(await chapter.render()).toContain('data-test="updated"');
  expect(calls).toBe(1);
  chapter.unload();
  expect(await chapter.render()).not.toContain('data-test');
  expect(calls).toBe(2);
  chapter.destroy();
  chapter.destroy();
  await expect(chapter.load()).rejects.toThrow('destroyed');
});

test('supports EPUB 2 external doctypes and XHTML entities without fetching a DTD', async () => {
  const chapter = section(() =>
    Promise.resolve(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "https://example.invalid/xhtml11.dtd">' +
        xhtml.replace('Original', '&nbsp;'),
    ),
  );
  expect(await chapter.render()).toContain('\u00a0');
});

test('retries after producer errors and rejects non-XHTML or internal DTDs', async () => {
  let calls = 0;
  const chapter = section(() => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error('failed')) : Promise.resolve(xhtml);
  });
  await expect(chapter.load()).rejects.toThrow('failed');
  expect(await chapter.render()).toContain('Original');
  await expect(section(() => Promise.resolve('<svg/>')).load()).rejects.toThrow('XHTML');
  await expect(
    section(() => Promise.resolve('<!DOCTYPE html [<!ENTITY x "boom">]>' + xhtml)).load(),
  ).rejects.toThrow('DTD');
});

test('one consumer can cancel while another awaits the same producer', async () => {
  const gate = deferred();
  const chapter = section(() => gate.promise);
  const controller = new AbortController();
  const aborted = chapter.load(controller.signal);
  const active = chapter.load();
  controller.abort();
  await expect(aborted).rejects.toThrow();
  gate.resolve(xhtml);
  expect(await active).toBeDefined();
  await expect(chapter.load(controller.signal)).rejects.toThrow();
});

test('unload invalidates stale results and allows a fresh load', async () => {
  const gate = deferred();
  let calls = 0;
  const chapter = section(() => {
    calls += 1;
    return calls === 1 ? gate.promise : Promise.resolve(xhtml);
  });
  const stale = chapter.load();
  chapter.unload();
  const fresh = await chapter.load();
  gate.resolve(xhtml);
  await expect(stale).rejects.toThrow();
  expect(await chapter.load()).toBe(fresh);
});

test('cleans signal subscriptions on both success and failure', async () => {
  const signal = new AbortController().signal;
  expect(await section(() => Promise.resolve(xhtml)).load(signal)).toBeDefined();
  await expect(section(() => Promise.reject(new Error('failure'))).load(signal)).rejects.toThrow(
    'failure',
  );
});

test('clears a synchronously throwing loader so a later load can retry', async () => {
  let attempts = 0;
  const chapter = section(() => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('synchronous failure');
    }
    return Promise.resolve(xhtml);
  });
  await expect(chapter.load()).rejects.toThrow('synchronous failure');
  expect(await chapter.render()).toContain('Original');
});
