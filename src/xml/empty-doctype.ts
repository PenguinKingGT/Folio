/** Normalize only inert bare XHTML empty subsets in the document prolog without rewriting publisher body text. */

/** Skip XML whitespace, comments, and processing instructions while leaving malformed prologs to the strict parser. */
function declarationOffset(source: string): number {
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (index < source.length) {
    const whitespace = source.slice(index).search(/[^ \t\r\n]/u);
    if (whitespace < 0) {
      return source.length;
    }
    index += whitespace;
    let end: number;
    let length: number;
    if (source.startsWith('<!--', index)) {
      end = source.indexOf('-->', index + 4);
      length = 3;
    } else if (source.startsWith('<?', index)) {
      end = source.indexOf('?>', index + 2);
      length = 2;
    } else {
      return index;
    }
    if (end < 0) {
      return source.length;
    }
    index = end + length;
  }
  return index;
}

/** XML permits optional space before an empty internal subset; remove that inert subset before native parsing. */
export function normalizeEmptyDoctype(source: string): string {
  const index = declarationOffset(source);
  const match = /^<!DOCTYPE[ \t\r\n]+html[ \t\r\n]*\[[ \t\r\n]*\][ \t\r\n]*>/u.exec(
    source.slice(index),
  );
  if (match === null) {
    return source;
  }
  return source.slice(0, index) + '<!DOCTYPE html>' + source.slice(index + match[0].length);
}
