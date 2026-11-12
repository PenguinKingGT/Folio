/** Bind native render hooks, interactions, themes, and exactly-once unload notification to one document. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import type { IframeView } from './iframe-view';
import type { Themes } from '../themes/themes';
import type { ContentInteractions } from '../interaction/interactions';

/** A view operation carries its own cancellation token and optional reader-owned services. */
interface ViewLoad {
  book: Book;
  section: Section;
  view: IframeView;
  content: string;
  token: string;
  signal: AbortSignal;
  themes: Themes | undefined;
  interactions: ContentInteractions | undefined;
}

/** Release notifications are owned by the caller and must run before document replacement or view removal. */
export async function loadViewContent(options: ViewLoad): Promise<{
  document: Document;
  release: () => void;
}> {
  const { book, section, view, content, token, signal, themes, interactions } = options;
  const document = await view.load(content, token, signal);
  const context = { section, document, frame: view.frame };
  let detached = false;
  let releaseInteractions: (() => void) | undefined;
  const release = () => {
    if (!detached) {
      detached = true;
      releaseInteractions?.();
      book.hooks.release(context);
    }
  };
  try {
    await book.hooks.render.run(context, signal);
    signal.throwIfAborted();
    releaseInteractions = interactions?.attach(document, section);
    await themes?.apply(document, signal);
    signal.throwIfAborted();
    return { document, release };
  } catch (error) {
    release();
    throw error;
  }
}
