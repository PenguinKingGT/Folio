/** Verify typed lifecycle and explicit passive-frame interaction events in native browser engines. */
import { Book } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { selectText } from '../interaction/fixture';

/** Selection and link control remain available even when a browser suppresses passive-frame callbacks. */
async function interact(reader: Rendition | ContinuousReader): Promise<boolean> {
  let selected = '';
  let links = 0;
  reader.once('selected', (selection) => {
    selected = selection?.text ?? '';
  });
  const stop = reader.on('link', (link) => {
    links += 1;
    link.preventDefault();
  });
  const document = reader.getContents();
  if (!document) {
    throw new Error('Missing event scenario chapter.');
  }
  selectText(document);
  const selection = reader.interactions.captureSelection();
  await reader.interactions.activate('../s2.xhtml#start-2');
  const cancelled = reader.currentSection?.index === 0;
  stop();
  const destination = await reader.interactions.activate('../s2.xhtml#start-2');
  return (
    selection !== null &&
    selected === selection.text &&
    links === 1 &&
    cancelled &&
    destination?.index === 2
  );
}

/** Observe one successful display, a failed target, real interactions, and terminal subscription cleanup. */
export async function runEventsScenario(continuous: boolean): Promise<{
  interactions: boolean;
  lifecycle: boolean;
  failures: boolean;
  cleaned: boolean;
}> {
  const book = await Book.open('/events.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  let created = 0;
  book.once('readerCreated', () => {
    created += 1;
  });
  const reader = continuous ? book.renderContinuous(host) : book.renderTo(host);
  let displayed = 0;
  let destroyed = 0;
  const errors: unknown[] = [];
  reader.once('displayed', () => {
    displayed += 1;
  });
  reader.once('destroyed', () => {
    destroyed += 1;
  });
  reader.on('error', (error) => errors.push(error));
  try {
    await reader.display();
    const interactions = await interact(reader);
    let failure: unknown;
    try {
      await reader.display('missing.xhtml');
    } catch (error) {
      failure = error;
    }
    reader.destroy();
    reader.destroy();
    return {
      interactions,
      lifecycle: created === 1 && displayed === 1 && destroyed === 1,
      failures: errors.length === 1 && errors[0] === failure,
      cleaned: host.querySelector('iframe') === null,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
