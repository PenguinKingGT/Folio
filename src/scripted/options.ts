/** Explicit execution permission and bounded injection settings for opaque-origin scripted chapter views. */
import { viewTimeout } from '../render/surface';
import { version } from '../version';
import type { DisplayTarget } from '../render/target';

/** Executable chapters accept logical chapter/href targets without promising host DOM-based percentage seeking. */
export type ScriptedTarget = Exclude<DisplayTarget, { percentage: number }>;

/** Scripted views expose chapter navigation and messages; native host DOM access is intentionally unavailable. */
export interface ScriptedOptions {
  scripts: true;
  popups?: boolean;
  inject?: readonly string[];
  readingSystem?: { name: string; version: string };
  width?: number | string;
  height?: number | string;
  loadTimeoutMs?: number;
  maxResourceBytes?: number;
}

/** Snapshot all mutable caller configuration before creating a frame or executing publication code. */
export interface ScriptedSettings {
  popups: boolean;
  inject: readonly string[];
  name: string;
  version: string;
  timeout: number;
  maxResourceBytes: number;
}

/** Bound host reading-system strings before embedding them as data in the bootstrap configuration. */
function identity(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 128) {
    throw new TypeError('Reading-system identity requires non-empty strings of at most 128 units.');
  }
  return value;
}

/** Validate and snapshot source strings without trusting an external array's element types. */
function injections(value: unknown): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 16) {
    throw new TypeError('Script injection requires at most 16 strings of up to 256 KiB each.');
  }
  return Object.freeze(
    value.map((code: unknown): string => {
      if (typeof code !== 'string' || code.length > 262_144) {
        throw new TypeError('Script injection requires at most 16 strings of up to 256 KiB each.');
      }
      return code;
    }),
  );
}

/** No inferred metadata flag or legacy option can substitute for explicit scripts: true authorization. */
export function scriptedSettings(options: ScriptedOptions): ScriptedSettings {
  if (options === null || typeof options !== 'object' || !Object.is(options.scripts, true)) {
    throw new TypeError('Scripted reading requires explicit scripts: true.');
  }
  if (options.popups !== undefined && typeof options.popups !== 'boolean') {
    throw new TypeError('Scripted popup permission must be a boolean.');
  }
  const inject = injections(options.inject);
  const maxResourceBytes =
    options.maxResourceBytes === undefined ? 32 * 1024 * 1024 : options.maxResourceBytes;
  if (
    !Number.isSafeInteger(maxResourceBytes) ||
    maxResourceBytes < 1 ||
    maxResourceBytes > 128 * 1024 * 1024
  ) {
    throw new RangeError('Scripted resource budgets must be integers from 1 through 128 MiB.');
  }
  const system = options.readingSystem;
  if (system !== undefined && (system === null || typeof system !== 'object')) {
    throw new TypeError('Reading-system identity must be an object.');
  }
  return {
    popups: options.popups ?? false,
    inject,
    name: system === undefined ? 'Folio' : identity(system.name),
    version: system === undefined ? version : identity(system.version),
    timeout: viewTimeout(options.loadTimeoutMs),
    maxResourceBytes,
  };
}
