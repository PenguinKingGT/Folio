/** Validate opt-in touch navigation before allocating reader-owned browser resources. */

/** Distances use viewport CSS pixels; natural scrolling and pinch zoom remain native. */
export interface TouchOptions {
  minDistance?: number;
  maxDurationMs?: number;
  axisRatio?: number;
}

/** Readers keep touch navigation disabled unless explicitly requested. */
export interface TouchSettings {
  touch?: boolean | TouchOptions;
}

/** Return a validated immutable copy, or null for disabled touch handling. */
export function touchOptions(value: TouchSettings['touch']): Required<TouchOptions> | null {
  if (value === undefined || value === false) {
    return null;
  }
  if (value !== true && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new TypeError('Touch navigation requires a boolean or settings object.');
  }
  const settings = value === true ? {} : value;
  const result = {
    minDistance: settings.minDistance ?? 32,
    maxDurationMs: settings.maxDurationMs ?? 800,
    axisRatio: settings.axisRatio ?? 1.5,
  };
  for (const [name, number] of Object.entries(result)) {
    if (!Number.isFinite(number) || number <= 0 || (name === 'axisRatio' && number < 1)) {
      throw new RangeError(`Invalid touch setting: ${name}.`);
    }
  }
  return Object.freeze(result);
}
