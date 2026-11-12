/** Validate bounded literal-query configuration before requesting a chapter body. */
import type { SearchOptions } from './types';

/** Filled flags make matching logic explicit without retaining caller-mutated option objects. */
export interface SearchSettings {
  caseSensitive: boolean;
  normalizeWhitespace: boolean;
  overlap: boolean;
  limit: number;
  context: number;
  signal: AbortSignal | undefined;
}

/** Return a validated settings snapshot and a normalized non-empty literal query. */
export function searchSettings(
  query: string,
  options: SearchOptions,
): { query: string; settings: SearchSettings } {
  if (typeof query !== 'string' || query.trim() === '' || query.length > 1024) {
    throw new TypeError('Search queries require 1–1024 non-empty UTF-16 code units.');
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Search options must be an object.');
  }
  const settings = {
    caseSensitive: options.caseSensitive === undefined ? false : options.caseSensitive,
    normalizeWhitespace:
      options.normalizeWhitespace === undefined ? true : options.normalizeWhitespace,
    overlap: options.overlap === undefined ? false : options.overlap,
    limit: options.limit === undefined ? 100 : options.limit,
    context: options.context === undefined ? 32 : options.context,
    signal: options.signal === undefined ? undefined : AbortSignal.any([options.signal]),
  };
  for (const flag of [settings.caseSensitive, settings.normalizeWhitespace, settings.overlap]) {
    if (typeof flag !== 'boolean') {
      throw new TypeError('Search flags must be booleans.');
    }
  }
  if (
    !Number.isInteger(settings.limit) ||
    settings.limit < 1 ||
    settings.limit > 1000 ||
    !Number.isInteger(settings.context) ||
    settings.context < 0 ||
    settings.context > 256
  ) {
    throw new RangeError('Invalid search result/context limit.');
  }
  settings.signal?.throwIfAborted();
  return {
    query: settings.normalizeWhitespace ? query.replace(/\s+/gu, ' ').trim() : query,
    settings,
  };
}
