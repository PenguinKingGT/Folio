/** Native owner cleanup aggregates independent extension failures and preserves asynchronous cancellation/unload ordering. */
import { Book } from '../../../src/index';
import type { IframeView, ViewOptions, Rendition, ContinuousReader } from '../../../src/index';
import { FailingView } from './fixture';
import { gate } from '../../unit/extensions/fixture';

/** Flatten only AggregateError containers while retaining every original failure for outcome checks. */
function failures(error: unknown): readonly string[] {
  if (error instanceof AggregateError) {
    const nested: readonly unknown[] = error.errors;
    return nested.flatMap(failures);
  }
  return [error instanceof Error ? error.message : String(error)];
}

/** Mutable test probes belong to host extensions and never enter the publisher document. */
interface CleanupProbe {
  views: IframeView[];
  destroyed: number;
  ended: number;
}

/** Install independent failing view, unload, and terminal phases for the same owned reader. */
function failingReader(
  book: Book,
  host: HTMLElement,
  continuous: boolean,
  probe: CleanupProbe,
): Rendition | ContinuousReader {
  const createView = (target: HTMLElement, options: ViewOptions) => {
    const view = new FailingView(target, options, () => {
      probe.destroyed += 1;
    });
    probe.views.push(view);
    return view;
  };
  const reader = continuous
    ? book.renderContinuous(host, { createView })
    : book.renderTo(host, { createView, spread: 'always' });
  book.hooks.unload.register(async () => {
    await Promise.resolve();
    throw new Error('Original unload phase');
  });
  book.on('destroyed', () => {
    probe.ended += 1;
    throw new Error('Original terminal phase');
  });
  return reader;
}

/** A deliberately broken view cannot prevent base document cleanup, another view cleanup, or final event closure. */
export async function runCleanupScenario(continuous: boolean): Promise<{
  allViews: boolean;
  cleared: boolean;
  errors: boolean;
  state: string;
  ended: number;
}> {
  const book = await Book.open('/lifecycle.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  const probe: CleanupProbe = { views: [], destroyed: 0, ended: 0 };
  const reader = failingReader(book, host, continuous, probe);
  try {
    await reader.display(1);
    let errors: readonly string[] = [];
    try {
      await book.destroyAsync();
    } catch (error) {
      errors = failures(error);
    }
    return {
      allViews:
        probe.views.length > 1 &&
        probe.destroyed === probe.views.length &&
        probe.views.every((view) => view.document === null),
      cleared: host.children.length === 0,
      errors: [
        'Original custom view cleanup',
        'Original unload phase',
        'Original terminal phase',
      ].every((message) => errors.includes(message)),
      state: book.state,
      ended: probe.ended,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}

/** A render callback cancelled before commit still owns a native unload context until all cleanup work finishes. */
export async function runCancelledCloseScenario(): Promise<{
  unloaded: boolean;
  state: string;
  cleared: boolean;
}> {
  const book = await Book.open('/lifecycle.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  const reader = book.renderTo(host);
  const started = gate();
  const held = gate();
  let unloaded = false;
  book.hooks.render.register(async () => {
    started.release();
    await held.promise;
  });
  book.hooks.unload.register(async () => {
    await book.text('images/cover.jpg');
    unloaded = true;
  });
  const display = reader.display().then(
    () => false,
    () => true,
  );
  try {
    await started.promise;
    await book.destroyAsync();
    return {
      unloaded: unloaded && (await display),
      state: book.state,
      cleared: host.children.length === 0,
    };
  } finally {
    held.release();
    book.destroy();
    host.remove();
  }
}
