/** Complete book rendering verifies inert empty-subset compatibility through headless and native/scripted preparation. */
import { book, host } from '../render/fixture';

/** Keep executable permission explicit while testing the same authored source through both reader implementations. */
export async function inertDoctype(
  scripted: boolean,
): Promise<{ readable: boolean; isolated: boolean }> {
  const publication = await book(
    '<?xml version="1.0"?><!-- Original prolog --><!DOCTYPE html[]><html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original inert subset</p><script>window.folio.postMessage({original:true})</script></body></html>',
  );
  const container = host();
  try {
    if (scripted) {
      const reader = publication.renderScriptedTo(container, { scripts: true });
      const delivered = new Promise<unknown>((resolve) => reader.on('message', resolve));
      await reader.display();
      const message = await delivered;
      return {
        readable:
          typeof message === 'object' &&
          message !== null &&
          'original' in message &&
          message.original === true,
        isolated:
          reader.frame.contentDocument === null &&
          reader.frame.getAttribute('sandbox') === 'allow-scripts',
      };
    }
    const reader = publication.renderTo(container);
    await reader.display();
    return {
      readable: reader.getContents()?.body.textContent?.includes('Original inert subset') === true,
      isolated:
        reader.getContents()?.querySelector('script') === null &&
        reader.frame.getAttribute('sandbox') === 'allow-same-origin',
    };
  } finally {
    publication.destroy();
    container.remove();
  }
}
