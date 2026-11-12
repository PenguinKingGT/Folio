/** Decode the repository-authored font through an original IDPF-obfuscated EPUB and native CSS loading. */
import { Book } from '../../../src/index';
import { encodedFont, fontZip, identifierKey } from '../../unit/obfuscation/fixture';
import { host } from '../render/fixture';

/** Return actual loaded font faces and glyph metrics, rather than accepting fallback typography. */
export async function obfuscatedFontScenario(
  obfuscated = true,
): Promise<{ loaded: number; width: number }> {
  const url = new URL('../../fixtures/fonts/wide.ttf', import.meta.url);
  const original = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const publication = await Book.open(
    fontZip(
      obfuscated ? encodedFont(original, identifierKey) : original,
      obfuscated ? undefined : null,
    ),
  );
  const container = host();
  const reader = publication.renderTo(container, { spread: 'none' });
  try {
    await reader.display();
    const content = reader.getContents();
    const sample = content?.getElementById('sample');
    if (!content || !sample) {
      throw new Error('Missing original font sample.');
    }
    const faces = await content.fonts.load('20px FolioObfuscated', 'AAAA');
    const range = content.createRange();
    range.selectNodeContents(sample);
    return { loaded: faces.length, width: range.getBoundingClientRect().width };
  } finally {
    publication.destroy();
    container.remove();
  }
}
