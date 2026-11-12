/** Native scroll fallback observes actual iframe offsets and cancels all host work without enabling frame scripts. */
import { expect, test, vi } from 'vitest';
import { NativeScrollMonitor, nativeScrollCallbacks } from '../../../src/render/native-scroll';
import { IframeView } from '../../../src/render/iframe-view';
import { prepareContent } from '../../../src/render/content';
import { host } from './fixture';
import { nextFrame } from '../issues/initial-resize';

/** Use a real independently scrollable frame without reader reflow callbacks altering test offsets. */
async function scrollFrame(): Promise<{
  target: Window;
  view: IframeView;
  container: HTMLDivElement;
}> {
  const container = host();
  const view = new IframeView(container, { height: 240 });
  await view.load(
    prepareContent(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body{height:2000px;margin:0}</style></head><body>Original scrolling</body></html>',
      'native-scroll',
    ),
    'native-scroll',
  );
  view.show();
  const target = view.document?.defaultView;
  if (!target) {
    throw new Error('Expected a native scrolling frame.');
  }
  return { target, view, container };
}

test('capability detection dispatches an inert native event and always removes its listener', () => {
  const remove = vi.spyOn(document, 'removeEventListener');
  try {
    expect(nativeScrollCallbacks(document)).toBe(true);
    expect(remove).toHaveBeenCalledWith('folio:scroll-capability', expect.any(Function));
  } finally {
    remove.mockRestore();
  }
});

test('only notifies on changed native offsets and stops after destruction', async () => {
  const { target, view, container } = await scrollFrame();
  let calls = 0;
  const observer = new NativeScrollMonitor(target, window, () => {
    calls++;
  });
  try {
    await nextFrame();
    await nextFrame();
    expect(calls).toBe(0);
    target.scrollTo({ top: 30, behavior: 'instant' });
    await expect.poll(() => calls).toBe(1);
    observer.destroy();
    observer.destroy();
    target.scrollTo({ top: 60, behavior: 'instant' });
    await nextFrame();
    await nextFrame();
    expect(calls).toBe(1);
  } finally {
    observer.destroy();
    view.destroy();
    container.remove();
  }
});

test('destruction inside notification prevents the fallback from scheduling again', async () => {
  const { target, view, container } = await scrollFrame();
  let calls = 0;
  let observer: NativeScrollMonitor | undefined;
  observer = new NativeScrollMonitor(target, window, () => {
    calls++;
    observer?.destroy();
  });
  try {
    target.scrollTo({ top: 30, behavior: 'instant' });
    await expect.poll(() => calls).toBe(1);
    target.scrollTo({ top: 60, behavior: 'instant' });
    await nextFrame();
    expect(calls).toBe(1);
  } finally {
    observer.destroy();
    view.destroy();
    container.remove();
  }
});

test('missing windows/schedulers and an already queued cancelled callback stay inert', () => {
  let callback: FrameRequestCallback | undefined;
  let cancelled = 0;
  let calls = 0;
  const scheduler = {
    requestAnimationFrame: (value: FrameRequestCallback) => {
      callback = value;
      return 1;
    },
    cancelAnimationFrame: () => {
      cancelled++;
    },
  };
  const observer = new NativeScrollMonitor(window, scheduler, () => {
    calls++;
  });
  observer.destroy();
  callback?.(0);
  new NativeScrollMonitor(null, scheduler, () => {
    calls++;
  }).destroy();
  new NativeScrollMonitor(window, null, () => {
    calls++;
  }).destroy();
  expect(cancelled).toBe(1);
  expect(calls).toBe(0);
});
