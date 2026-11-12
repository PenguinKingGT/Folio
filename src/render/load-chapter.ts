/** Prepare passive chapter markup through the shared resource policy before native view loading. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { prepareContent } from './content';

/** Resolve a local spine document, sanitize it, and replace its asset references. */
export async function chapterMarkup(
  book: Book,
  section: Section,
  token: string,
  signal: AbortSignal,
): Promise<string> {
  const address = book.resources.resolve(section.href);
  if (address.kind !== 'local') {
    throw new TypeError('Chapter rendering requires a local publication resource.');
  }
  const passive = prepareContent(await section.render(signal), token);
  const content = await book.resources.rewrite(passive, address.path, signal);
  signal.throwIfAborted();
  return content;
}
