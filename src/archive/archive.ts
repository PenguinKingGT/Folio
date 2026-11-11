/** Document-independent ZIP resource access and URL lifecycle. */
import { mimeType } from './mime';
import { validateArchivePath } from './path';
import { extractArchive } from './unzip';
import type { ArchiveLimits } from './unzip';

/** Encode bytes in chunks to avoid argument-count limits for large files. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

/** Read-only archive access with isolated results and explicit destruction. */
export class Archive {
  private readonly entries: Map<string, Uint8Array>;
  private readonly urls = new Map<string, { path: string; url: string; object: boolean }>();
  private destroyed = false;

  /** Construct from ZIP bytes; failures never expose partial resources. */
  constructor(input: Uint8Array | ArrayBuffer, limits: ArchiveLimits = {}) {
    this.entries = extractArchive(new Uint8Array(input), limits);
  }

  /** Return an independent filename list excluding directory placeholders. */
  list(): string[] {
    this.assertActive();
    return [...this.entries.keys()];
  }

  /** Return copied bytes; missing entries throw RangeError. */
  getBytes(path: string): Uint8Array<ArrayBuffer> {
    this.assertActive();
    const entry = this.entries.get(validateArchivePath(path));
    if (entry === undefined) {
      throw new RangeError(`Archive entry not found: ${path}`);
    }
    return Uint8Array.from(entry);
  }

  /** Strictly decode text using the requested encoding; invalid data throws. */
  getText(path: string, encoding = 'utf-8'): string {
    return new TextDecoder(encoding, { fatal: true }).decode(this.getBytes(path));
  }

  /** Create a typed Blob whose lifetime is independent of the archive. */
  getBlob(path: string, type = mimeType(path)): Blob {
    return new Blob([this.getBytes(path)], { type });
  }

  /** Return raw Base64 without a data URL prefix. */
  getBase64(path: string): string {
    return encodeBase64(this.getBytes(path));
  }

  /** Cache Blob or data URLs independently for each path, MIME, and mode. */
  createUrl(path: string, options: { base64?: boolean; type?: string } = {}): string {
    this.assertActive();
    const type = options.type ?? mimeType(path);
    const key = JSON.stringify([path, type, options.base64 ?? false]);
    const cached = this.urls.get(key);
    if (cached !== undefined) {
      return cached.url;
    }
    const object = options.base64 !== true;
    const url = object
      ? URL.createObjectURL(this.getBlob(path, type))
      : `data:${type};base64,${this.getBase64(path)}`;
    this.urls.set(key, { path, url, object });
    return url;
  }

  /** Release every cached URL for a path; safe to repeat. */
  revokeUrl(path: string): void {
    for (const [key, entry] of this.urls) {
      if (entry.path === path) {
        if (entry.object) {
          URL.revokeObjectURL(entry.url);
        }
        this.urls.delete(key);
      }
    }
  }

  /** Release entries and object URLs; repeated destruction is safe. */
  destroy(): void {
    for (const entry of this.urls.values()) {
      this.revokeUrl(entry.path);
    }
    this.entries.clear();
    this.destroyed = true;
  }

  /** Reject reads consistently after destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Archive has been destroyed.');
    }
  }
}
