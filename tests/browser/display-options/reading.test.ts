/** Legacy EPUB 2 display options select actual fixed geometry while interactive metadata keeps passive isolation. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { appleFiles, appleXml } from '../../unit/display-options/fixture';
import { host } from '../render/fixture';

test('legacy fixed layout retains authored viewport and spread preference while explicit host options win', async () => {
  const book = await Book.open(bookZip(appleFiles()));
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display(1);
    expect(reader.fixedLayout?.primary.width).toBe(600);
    expect(reader.fixedLayout?.primary.height).toBe(800);
    expect(reader.getRenderedPages()).toHaveLength(2);
    expect(reader.getContents()?.querySelector('script')).toBeNull();
    expect(
      Reflect.get(reader.getContents()?.defaultView ?? {}, 'appleInteractive'),
    ).toBeUndefined();
    expect(reader.frame.getAttribute('sandbox')).toBe('allow-same-origin');
    reader.layout({ spread: 'none' });
    expect(reader.getRenderedPages()).toHaveLength(1);
    reader.layout({ spread: 'always' });
    expect(reader.getRenderedPages()).toHaveLength(2);
  } finally {
    book.destroy();
    container.remove();
  }
});

test('explicit false spread preference stays single-page and continuous readers retain fixed containing blocks', async () => {
  const files = appleFiles(
    appleXml(
      '<option name="fixed-layout">true</option><option name="open-to-spread">false</option>',
    ),
  );
  const book = await Book.open(bookZip(files));
  const container = host();
  const continuousHost = host();
  try {
    const bounded = book.renderTo(container);
    await bounded.display(1);
    expect(bounded.getRenderedPages()).toHaveLength(1);
    const continuous = book.renderContinuous(continuousHost);
    await continuous.display(1);
    expect(
      continuous.getLoadedPages().every((page) => page.frame.contentWindow?.innerWidth === 600),
    ).toBe(true);
    expect(
      continuous
        .getLoadedPages()
        .every((page) => page.frame.getAttribute('sandbox') === 'allow-same-origin'),
    ).toBe(true);
  } finally {
    book.destroy();
    container.remove();
    continuousHost.remove();
  }
});
