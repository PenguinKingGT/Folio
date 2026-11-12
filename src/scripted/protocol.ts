/** Decode only bounded JSON messages from a reader's current opaque frame session. */

/** Ready messages complete the handshake; errors and caller messages remain unprivileged notifications. */
export type ScriptMessage =
  { type: 'ready' } | { type: 'error'; value: string } | { type: 'message'; value: unknown };

/** Source-window checks belong to the frame owner; token/type/size/JSON checks belong to this protocol boundary. */
export function scriptMessage(input: unknown, token: string): ScriptMessage | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('folio' in input) ||
    input.folio !== token ||
    !('type' in input)
  ) {
    return null;
  }
  if (input.type === 'ready') {
    return { type: 'ready' };
  }
  if (!('value' in input) || typeof input.value !== 'string') {
    return null;
  }
  if (input.type === 'error' && input.value.length <= 512) {
    return { type: 'error', value: input.value };
  }
  if (input.type !== 'message' || input.value.length > 65_536) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(input.value);
    return { type: 'message', value };
  } catch {
    return null;
  }
}
