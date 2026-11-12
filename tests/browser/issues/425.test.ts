/** Upstream #425 investigation: destroyed passive views must not retain chapter markup through exposed iframe references. */
import { expect, test } from 'vitest';
import { IframeView } from '../../../src/index';
import { prepareContent } from '../../../src/render/content';
import { host } from '../render/fixture';

test('releases source markup when the host retains a destroyed native view', async () => {
  const container = host();
  const view = new IframeView(container);
  const marker = 'Original retained chapter marker';
  const source = `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>${marker.repeat(1000)}</p></body></html>`;
  try {
    await view.load(prepareContent(source, 'retained'), 'retained');
    expect(view.frame.srcdoc).toContain(marker);
    view.destroy();
    expect(view.document).toBeNull();
    expect(view.frame.isConnected).toBe(false);
    expect(view.frame.srcdoc).toBe('');
    expect(view.frame.hasAttribute('srcdoc')).toBe(false);
    view.destroy();
  } finally {
    view.destroy();
    container.remove();
  }
});

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} repeated book closure releases retained frame sources and asset URLs`, async () => {
    const { repeatedClose } = await import('./repeated-close');
    expect(await repeatedClose(continuous)).toEqual({
      cycles: 8,
      frames: true,
      sources: true,
      urls: true,
    });
  });
}
