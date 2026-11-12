/** Validate bounded JSON values without assertions or browser dependencies. */

/** Narrow JSON dictionaries while rejecting arrays and null before field access. */
export function dictionary(value: unknown, name: string): Record<string, unknown> {
  if (!isDictionary(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

/** A runtime object check provides the indexable JSON boundary used by all manifest readers. */
function isDictionary(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Preserve caller arrays without mutating them; subsequent parsers always create their own models. */
export function list(value: unknown, name: string, optional = false): readonly unknown[] {
  if (value === undefined && optional) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new TypeError(`${name} must be an array of at most 10,000 entries.`);
  }
  return value;
}

/** Required metadata and identities are non-empty bounded strings, with an optional absent default. */
export function text(value: unknown, name: string, optional = false): string {
  if (value === undefined && optional) {
    return '';
  }
  if (typeof value !== 'string' || (!optional && value.trim() === '') || value.length > 16_384) {
    throw new TypeError(`${name} must be a non-empty bounded string.`);
  }
  return value.trim();
}

/** Accept legacy whitespace token strings and modern arrays, producing independent deduplicated tokens. */
export function tokens(value: unknown, name: string): readonly string[] {
  if (value === undefined) {
    return [];
  }
  const values =
    typeof value === 'string' ? value.trim().split(/\s+/u).filter(Boolean) : list(value, name);
  return Array.from(new Set(values.map((entry) => text(entry, name))));
}

/** Validate href syntax without applying a fictitious container root before the actual manifest URL is known. */
export function href(value: unknown, name: string): string {
  const result = text(value, name);
  if (
    result.length > 4096 ||
    Array.from(result).some((char) => char.charCodeAt(0) < 32) ||
    /^(?:javascript|vbscript|file):/iu.test(result)
  ) {
    throw new TypeError(`Invalid ${name}.`);
  }
  decodeURI(result);
  return result;
}

/** Select the first present alias without treating explicit null as an absent value. */
export function field(value: Record<string, unknown>, ...names: readonly string[]): unknown {
  for (const name of names) {
    if (value[name] !== undefined) {
      return value[name];
    }
  }
  return undefined;
}
