/** Encode executable sources and assets as data URLs that remain usable inside an opaque sandbox origin. */

/** Chunk conversion avoids argument-count limits without creating any host-owned Blob URL. */
export function dataUrl(bytes: Uint8Array, type: string): string {
  if (!/^[a-z\d.+-]+\/[a-z\d.+-]+$/iu.test(type)) {
    throw new TypeError('Invalid embedded resource media type.');
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/** Script and stylesheet text never appears as raw HTML script/style content during serialization. */
export function textUrl(source: string, type: string): string {
  return dataUrl(new TextEncoder().encode(source), type);
}
