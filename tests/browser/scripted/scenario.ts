/** Cross-engine scripted execution and real popup gestures retain opaque-origin host isolation. */
import { Book } from '../../../src/index';
import type { ScriptedReader } from '../../../src/index';

let mounted: {
  book: Book;
  reader: ScriptedReader;
  host: HTMLDivElement;
  messages: unknown[];
} | null = null;

/** Keep the native surface visible for real pointer activation inside the opaque frame. */
export async function mountScriptedScenario(popups: boolean): Promise<{
  messages: readonly unknown[];
  opaque: boolean;
  sandbox: string | null;
  isolated: boolean;
}> {
  const book = await Book.open('/scripted.epub');
  const host = document.createElement('div');
  host.id = 'scripted-host';
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:100;width:500px;height:400px';
  document.body.appendChild(host);
  const reader = book.renderScriptedTo(host, {
    scripts: true,
    popups,
    inject: [
      'window.executionOrder=["injected-first"]',
      'window.executionOrder.push("injected-second")',
    ],
  });
  const messages: unknown[] = [];
  reader.on('message', (value) => messages.push(value));
  mounted = { book, reader, host, messages };
  await reader.display();
  return {
    messages,
    opaque: reader.frame.contentDocument === null && reader.getContents() === null,
    sandbox: reader.frame.getAttribute('sandbox'),
    isolated: !document.body.hasAttribute('data-publisher-escape'),
  };
}

/** Return only already validated publication JSON notifications for polling across native browser task queues. */
export function scriptedMessages(): readonly unknown[] {
  return mounted?.messages ?? [];
}

/** Book-owned frame destruction releases executable content and its host listener. */
export function disposeScriptedScenario(): void {
  mounted?.book.destroy();
  mounted?.host.remove();
  mounted = null;
}

/** Expose the retained typed failure for cross-engine diagnostics without reading the opaque document. */
export function scriptedFailure(): string | null {
  const error = mounted?.reader.lastError;
  return error instanceof Error ? error.message : null;
}
