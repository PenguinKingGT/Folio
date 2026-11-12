/** Bound decoded network bodies independently of archive extraction or declared HTTP sizes. */
export const defaultResponseBytes = 64 * 1024 * 1024;

/** Reject invalid configuration before invoking the transport or allocating response buffers. */
export function responseLimit(value: number = defaultResponseBytes): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('Response byte limits must be positive safe integers.');
  }
  return value;
}
