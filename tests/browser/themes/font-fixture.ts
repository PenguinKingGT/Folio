/** Load the repository-authored font as a CSP-compatible inline source for real font-loading tests. */

/** Return fixture bytes without relying on an external font service or platform font installation. */
export async function originalFont(): Promise<string> {
  const url = new URL('../../fixtures/fonts/wide.ttf', import.meta.url);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const encoded = btoa(
    Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join(''),
  );
  return `data:font/ttf;base64,${encoded}`;
}
