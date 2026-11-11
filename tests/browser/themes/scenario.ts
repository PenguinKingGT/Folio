/** Cross-engine theme scenarios cover font loading, successive reflows, and styles on newly loaded chapters. */
import { Book } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { contains } from './fixture';
import { originalFont } from './font-fixture';

/** Both reader kinds expose the same theme and logical-location contracts. */
type Reader = Rendition | ContinuousReader;

/** Resolve continuous observer work after synchronous theme-driven layout. */
async function settled(reader: Reader): Promise<void> {
  if ('whenIdle' in reader) {
    await reader.whenIdle();
  }
}

/** Keep one logical CFI through repeated font preferences and a genuinely loaded original font. */
async function fontChanges(reader: Reader, point: string): Promise<boolean> {
  for (const size of [24, 12, 28, 16]) {
    await reader.themes.fontSize(size);
    await settled(reader);
    if (!contains(reader.currentLocation(), point)) {
      return false;
    }
  }
  await reader.themes.registerCss(
    'wide',
    `@font-face{font-family:FolioWide;src:url(${await originalFont()})}p{font-family:FolioWide!important}`,
  );
  await reader.themes.select('wide');
  await settled(reader);
  return (
    contains(reader.currentLocation(), point) &&
    reader.getContents()?.fonts.check('16px FolioWide') === true
  );
}

/** A newly loaded hidden chapter must become displayable before deferred font readiness is awaited. */
async function inheritedFont(reader: Reader): Promise<boolean> {
  await reader.display(5);
  await settled(reader);
  const document = reader.getContents();
  await document?.fonts.ready;
  return (
    document?.fonts.check('16px FolioWide') === true &&
    document.querySelector('[data-folio-theme]')?.textContent?.includes('FolioWide') === true
  );
}

/** Return observable theme, anchor, and resource behavior for Chromium, Firefox, and WebKit. */
export async function runThemeScenario(continuous: boolean): Promise<{
  preserved: boolean;
  color: string | undefined;
  current: string;
  styles: number | undefined;
}> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  const book = await Book.open('/themes.epub');
  const reader = continuous ? book.renderContinuous(host) : book.renderTo(host, { spread: 'none' });
  try {
    await reader.display(4);
    await reader.next();
    await reader.next();
    const point = reader.currentLocation()?.start.cfi ?? '';
    await reader.themes.registerUrl('night', 'themes/night.css');
    await reader.themes.select('night');
    const preserved =
      contains(reader.currentLocation(), point) &&
      (await fontChanges(reader, point)) &&
      (await inheritedFont(reader));
    await reader.themes.select('night');
    await reader.display(6);
    await settled(reader);
    const document = reader.getContents();
    const paragraph = document?.querySelector('p');
    return {
      preserved,
      color: paragraph ? document?.defaultView?.getComputedStyle(paragraph).color : undefined,
      current: reader.themes.current,
      styles: document?.querySelectorAll('[data-folio-theme]').length,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
