/** Deterministic native iframe error, cancellation and timeout paths without network dependencies. */
import { expect, test, vi } from 'vitest';
import { IframeView } from '../../../src/render/iframe-view';
import { prepareContent } from '../../../src/render/content';
import { host, xhtml } from './fixture';

test('ignores initial events, rejects explicit load errors and permits a later load', async () => {
  const container = host();
  const view = new IframeView(container);
  try {
    const failed = view.load(prepareContent(xhtml, 'first'), 'first');
    view.frame.dispatchEvent(new Event('load'));
    view.frame.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow('failed to load');
    expect((await view.load(prepareContent(xhtml, 'second'), 'second')).body.textContent).toBe(
      'Original chapter',
    );
    view.destroy();
    view.destroy();
    await expect(view.load(xhtml, 'closed')).rejects.toThrow('destroyed');
  } finally {
    view.destroy();
    container.remove();
  }
});

test('cancels pending and pre-cancelled iframe loads', async () => {
  const container = host();
  const view = new IframeView(container);
  const controller = new AbortController();
  const pending = view.load(prepareContent(xhtml, 'pending'), 'pending', controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  await expect(view.load(xhtml, 'pre-cancelled', controller.signal)).rejects.toThrow();
  const destroyed = view.load(prepareContent(xhtml, 'destroyed'), 'destroyed');
  view.destroy();
  await expect(destroyed).rejects.toThrow();
  container.remove();
});

test('times out using a controlled clock and clears operation subscriptions', async () => {
  vi.useFakeTimers();
  const container = host();
  const view = new IframeView(container, { loadTimeoutMs: 25 });
  try {
    const pending = view.load(prepareContent(xhtml, 'timeout'), 'timeout');
    const assertion = expect(pending).rejects.toThrow('timed out');
    vi.advanceTimersByTime(25);
    await assertion;
  } finally {
    view.destroy();
    container.remove();
    vi.useRealTimers();
  }
});
