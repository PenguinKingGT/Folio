/** Owned cancellation must promptly settle consumers even when their injected transport ignores the signal. */
import { expect, test } from 'vitest';
import { Cover, Resources, createRequester, parsePackage } from '../../../src/index';
import { bookFiles } from '../book/fixture';
import { deferred, nextTurn, outcome } from './fixture';

test('request lifetime cancellation cannot be overridden by a per-request signal or an uncooperative fetch', async () => {
  const producer = deferred<Response>();
  const started = deferred<void>();
  const lifetime = new AbortController();
  const consumer = new AbortController();
  const request = createRequester({
    signal: lifetime.signal,
    fetch: () => {
      started.resolve();
      return producer.promise;
    },
  });
  const observed = outcome(
    request('https://original.invalid/held', 'text', { signal: consumer.signal }),
  );
  try {
    await started.promise;
    lifetime.abort();
    await nextTurn();
    expect(observed.state()).toBe('rejected');
  } finally {
    producer.resolve(new Response('late'));
    await observed.done;
  }
});

test('body cancellation settles the request and cancels its owned native stream reader', async () => {
  const started = deferred<void>();
  let cancelled = false;
  let pipe: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>(
    {
      start: (controller) => {
        pipe = controller;
      },
      pull: () => {
        started.resolve();
      },
      cancel: () => {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const controller = new AbortController();
  const request = createRequester({ fetch: () => Promise.resolve(new Response(stream)) });
  const observed = outcome(
    request('https://original.invalid/body', 'text', { signal: controller.signal }),
  );
  try {
    await started.promise;
    controller.abort();
    await nextTurn();
    expect(observed.state()).toBe('rejected');
    expect(cancelled).toBe(true);
  } finally {
    // Finish the baseline producer only after verifying prompt cancellation independently.
    if (!cancelled) {
      pipe?.close();
    }
    await observed.done;
  }
});

for (const action of ['revokeUrl', 'destroy'] as const) {
  test(`cover ${action} rejects a held consumer before the producer resolves`, async () => {
    const producer = deferred<Blob>();
    const started = deferred<void>();
    const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
    const cover = new Cover(publication, () => {
      started.resolve();
      return producer.promise;
    });
    const observed = outcome(cover.url());
    try {
      await started.promise;
      cover[action]();
      await nextTurn();
      expect(observed.state()).toBe('rejected');
    } finally {
      producer.resolve(new Blob(['late']));
      await observed.done;
      cover.destroy();
    }
  });
}

test('resource destruction rejects a held URL consumer before its byte producer resolves', async () => {
  const producer = deferred<Uint8Array>();
  const started = deferred<void>();
  const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
  const resources = new Resources(publication, 'OPS/package.opf', () => {
    started.resolve();
    return producer.promise;
  });
  const observed = outcome(resources.url('images/cover.jpg'));
  try {
    await started.promise;
    resources.destroy();
    await nextTurn();
    expect(observed.state()).toBe('rejected');
  } finally {
    producer.resolve(new Uint8Array([1]));
    await observed.done;
    resources.destroy();
  }
});

test('rewriting cancels one waiting consumer without aborting shared book-owned resource I/O', async () => {
  const producer = deferred<Uint8Array>();
  const started = deferred<void>();
  let owner: AbortSignal | undefined;
  const publication = parsePackage(bookFiles().get('OPS/package.opf') ?? '');
  const resources = new Resources(publication, 'OPS/package.opf', (_path, signal) => {
    owner = signal;
    started.resolve();
    return producer.promise;
  });
  const controller = new AbortController();
  const operation: unknown = Reflect.apply(resources.rewrite.bind(resources), resources, [
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="images/cover.jpg"/></body></html>',
    'OPS/package.opf',
    controller.signal,
  ]);
  const observed = outcome(Promise.resolve(operation));
  try {
    await started.promise;
    controller.abort();
    await nextTurn();
    expect(observed.state()).toBe('rejected');
    expect(owner?.aborted).toBe(false);
  } finally {
    producer.resolve(new Uint8Array([1]));
    await observed.done;
    resources.destroy();
  }
});
