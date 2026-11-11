/** Assertion-aware tokenization shared by CFI parsing and DOM identifier matching. */

const reserved = '^[](),;=';

/** Split only outside assertions, validating circumflex escapes and bracket balance. */
export function splitCfi(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let bracket = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    if (character === '^') {
      index += 1;
      if (index >= value.length || !reserved.includes(value.charAt(index))) {
        throw new TypeError('Invalid CFI escape.');
      }
    } else if (character === '(' || character === ')') {
      throw new TypeError('CFI assertion parentheses must be escaped.');
    } else if (character === '[') {
      if (bracket) {
        throw new TypeError('Nested CFI assertions are invalid.');
      }
      bracket = true;
    } else if (character === ']') {
      if (!bracket) {
        throw new TypeError('Unexpected CFI assertion terminator.');
      }
      bracket = false;
    } else if (!bracket && character === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (bracket) {
    throw new TypeError('Unclosed CFI assertion.');
  }
  parts.push(value.slice(start));
  return parts;
}

/** Escape a literal identifier or text assertion component. */
export function escapeCfi(value: string): string {
  return value.replace(/[\^[\](),;=]/g, '^$&');
}

/** Read a step's ID assertion, ignoring unescaped extension parameters. */
export function assertionId(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    if (character === ';') {
      break;
    }
    if (character === '^') {
      index += 1;
      result += value.charAt(index);
    } else {
      result += character;
    }
  }
  return result;
}
