/** Normalize caller input into archive bytes or a requestable book address. */
export type InputType = 'epub' | 'opf' | 'directory' | 'json' | 'base64';

/** Explicit input options; Base64 requires a type hint to avoid misclassifying URLs. */
export interface InputOptions {
  type?: InputType;
  baseUrl?: string;
}

/** Normalized source discriminated by type for loading and extraction. */
export type BookSource =
  | { type: 'binary'; data: Uint8Array }
  | { type: 'epub' | 'opf' | 'directory' | 'json'; url: string };

/**
 * Identify input and copy binary data to isolate later caller mutations.
 * @throws TypeError Input is empty, conflicts with its explicit type, or contains invalid Base64.
 */
export function resolveInput(
  input: string | URL | ArrayBuffer | Uint8Array,
  options: InputOptions = {},
): BookSource {
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    if (options.type !== undefined) {
      throw new TypeError('Binary input cannot specify a text input type.');
    }
    return { type: 'binary', data: new Uint8Array(input).slice() };
  }
  const value = input.toString().trim();
  if (value.length === 0) {
    throw new TypeError('Book input cannot be empty.');
  }
  if (options.type === 'base64') {
    return { type: 'binary', data: decodeBase64(value) };
  }
  const url = options.baseUrl === undefined ? value : new URL(value, options.baseUrl).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|blob:)/i.test(url)) {
    throw new TypeError('Unsupported book URL protocol.');
  }
  return { type: options.type ?? inferType(url), url };
}

/** Inspect only the path extension; ignore query parameters and fragments. */
function inferType(url: string): 'epub' | 'opf' | 'json' | 'directory' {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  const extension = /\.(epub|opf|json)$/i.exec(path)?.[1]?.toLowerCase();
  if (extension === 'epub' || extension === 'opf' || extension === 'json') {
    return extension;
  }
  return 'directory';
}

/** Decode standard Base64, allowing ASCII whitespace and omitted trailing padding. */
function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/[\t\n\r ]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new TypeError('Invalid Base64 input.');
  }
  try {
    const decoded = atob(normalized);
    if (decoded.length === 0) {
      throw new TypeError('Empty Base64 input.');
    }
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch (cause) {
    throw new TypeError('Invalid Base64 input.', { cause });
  }
}
