/** Parse structural CFI steps and UTF-16 offsets without lossy numeric coercion. */
import { splitCfi } from './syntax';
import type { CfiPath, CfiStep } from './types';

/** Parse a positive step or a non-negative terminal with an optional escaped assertion. */
function component(source: string, allowZero: boolean): CfiStep {
  const match = /^(0|[1-9]\d*)(?:\[((?:\^.|[^\]])*)\])?$/.exec(source);
  const value = Number(match?.[1]);
  if (match === null || !Number.isSafeInteger(value) || (!allowZero && value === 0)) {
    throw new TypeError('Invalid CFI numeric component.');
  }
  return { value, assertion: match[2] ?? null };
}

/** Parse a full local path, or an endpoint suffix that may contain only a character offset. */
export function parseCfiPath(source: string, relative = false): CfiPath {
  const pieces = splitCfi(source, ':');
  const structural = pieces[0] ?? '';
  if (pieces.length > 2 || (!structural.startsWith('/') && !(relative && structural === ''))) {
    throw new TypeError('Invalid CFI structural path.');
  }
  const steps =
    structural === ''
      ? []
      : splitCfi(structural.slice(1), '/').map((step) => component(step, false));
  const terminal = pieces[1] === undefined ? null : component(pieces[1], true);
  if (steps.length === 0 && terminal === null) {
    throw new TypeError('CFI path cannot be empty.');
  }
  if (steps.some((step, index) => step.value % 2 === 1 && index !== steps.length - 1)) {
    throw new TypeError('A text CFI step cannot have child steps.');
  }
  return { steps, offset: terminal?.value ?? null, assertion: terminal?.assertion ?? null };
}

/** Serialize a previously validated path, preserving assertion escaping and offset zero. */
export function serializeCfiPath(path: CfiPath): string {
  let result = path.steps
    .map((step) => `/${step.value}${step.assertion === null ? '' : `[${step.assertion}]`}`)
    .join('');
  if (path.offset !== null) {
    result += `:${path.offset}${path.assertion === null ? '' : `[${path.assertion}]`}`;
  }
  return result;
}
