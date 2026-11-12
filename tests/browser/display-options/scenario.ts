/** Native engines honor legacy fixed pages and spread defaults without granting interactive execution privileges. */
import { Book } from '../../../src/index';

/** Check actual authored viewport geometry, host overrides, and default passive sandboxing. */
export async function runDisplayOptionsScenario(): Promise<{
  fixed: boolean;
  spread: boolean;
  override: boolean;
  passive: boolean;
  advisory: boolean;
}> {
  const book = await Book.open('/apple-options.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:500px;height:400px';
  document.body.appendChild(host);
  const reader = book.renderTo(host);
  try {
    await reader.display(1);
    const document = reader.getContents();
    const fixed =
      reader.fixedLayout?.primary.width === 600 && reader.frame.contentWindow?.innerWidth === 600;
    const spread = reader.getRenderedPages().length === 2;
    const passive =
      document?.querySelector('script') === null &&
      reader.frame.getAttribute('sandbox') === 'allow-same-origin' &&
      Reflect.get(document?.defaultView ?? {}, 'appleInteractive') === undefined;
    reader.layout({ spread: 'none' });
    return {
      fixed,
      spread,
      passive,
      override: reader.getRenderedPages().length === 1,
      advisory:
        book.displayOptions?.interactive === true &&
        book.displayOptions.orientationLock === 'landscape-only',
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
