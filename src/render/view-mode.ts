/** Validate legacy view selectors before allocating content or invoking a trusted host view factory. */

/** Inline host-document insertion cannot preserve the native document/CSP/CFI contract of built-in readers. */
export function validateViewMode(mode: unknown): void {
  if (mode !== undefined && mode !== 'iframe') {
    throw new TypeError(
      'Built-in readers support view="iframe" only; use Book.renderWith() for a host-owned custom manager.',
    );
  }
}
