/** Convert the supported epub.js-style JSON metadata fields into existing publication metadata contracts. */
import type { PackageMetadata } from '../package/types';
import { dictionary, field, list, text } from './values';

/** Author arrays can contain names or objects with a name; singular legacy creator strings remain supported. */
function creators(value: unknown): readonly string[] {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return [];
  }
  const entries = typeof value === 'string' ? [value] : list(value, 'metadata creators');
  return entries.map((entry) =>
    text(typeof entry === 'string' ? entry : dictionary(entry, 'author').name, 'author name'),
  );
}

/** Preserve required book identity while retaining optional legacy Dublin Core fields. */
export function manifestMetadata(value: unknown): PackageMetadata {
  const metadata = dictionary(value, 'metadata');
  const languages = Array.isArray(metadata.language)
    ? list(metadata.language, 'languages')
    : [metadata.language];
  const language = languages.map((entry) => text(entry, 'metadata language'))[0];
  if (language === undefined) {
    throw new TypeError('metadata language cannot be empty.');
  }
  return {
    identifier: text(metadata.identifier, 'metadata identifier'),
    title: text(metadata.title, 'metadata title'),
    language,
    creators: creators(field(metadata, 'creators', 'author', 'creator')),
    description: text(metadata.description, 'metadata description', true),
    publisher: text(metadata.publisher, 'metadata publisher', true),
    date: text(metadata.date, 'metadata date', true),
    rights: text(metadata.rights, 'metadata rights', true),
    entries: [],
  };
}

/** Retain explicit supported rendition properties and normalize the common fixed-layout alias. */
export function manifestRendition(
  metadata: Record<string, unknown>,
): Readonly<Record<string, string>> {
  const settings =
    metadata.rendition === undefined ? {} : dictionary(metadata.rendition, 'rendition');
  const pairs: [string, string][] = [];
  for (const key of ['layout', 'flow', 'spread', 'orientation']) {
    const value = settings[key] === undefined ? metadata[key] : settings[key];
    if (value !== undefined) {
      const property = text(value, `rendition ${key}`);
      pairs.push([key, key === 'layout' && property === 'fixed' ? 'pre-paginated' : property]);
    }
  }
  return Object.fromEntries(pairs);
}

/** JSON reading progression is a publication default, just like OPF page progression. */
export function manifestDirection(metadata: Record<string, unknown>): 'ltr' | 'rtl' | 'default' {
  const configured = field(metadata, 'direction', 'readingProgression');
  const value = configured === undefined ? 'default' : configured;
  if (value !== 'ltr' && value !== 'rtl' && value !== 'default') {
    throw new TypeError('Invalid JSON reading progression.');
  }
  return value;
}
