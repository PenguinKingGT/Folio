/** Validate or uniquely repair exact text assertions within one logical CFI text slot. */
import { splitCfi } from '../syntax';

/** Decode a previously validated literal assertion component. */
function literal(value: string): string {
  return value.replace(/\^([\s\S])/g, '$1');
}

/** Resolve before/after text assertions; ambiguous repairs reject instead of selecting wrong text. */
export function assertedOffset(text: string, offset: number, assertion: string | null): number {
  if (assertion === null) {
    return offset;
  }
  const context = splitCfi(assertion, ';')[0] ?? '';
  if (context === '') {
    return offset;
  }
  const parts = splitCfi(context, ',');
  const before = literal(parts[0] ?? '');
  const after = literal(parts[1] ?? '');
  if (
    text.slice(Math.max(0, offset - before.length), offset) === before &&
    text.slice(offset, offset + after.length) === after
  ) {
    return offset;
  }
  const pattern = before + after;
  const first = text.indexOf(pattern);
  if (first === -1 || text.indexOf(pattern, first + 1) !== -1) {
    throw new TypeError('CFI text assertion cannot be uniquely resolved.');
  }
  return first + before.length;
}

/** Side bias selects the following text node at a logical-node boundary when explicitly requested. */
export function afterBias(assertion: string | null): boolean {
  return assertion !== null && splitCfi(assertion, ';').includes('s=a');
}
