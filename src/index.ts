/** Public Folio entry point; capabilities are implemented in focused modules. */

/** Library version for diagnostics; consult the migration tracker for supported capabilities. */
export const version = '0.1.0';

export { resolveInput } from './input/source';
export type { BookSource, InputOptions, InputType } from './input/source';
export { createRequester, HttpError } from './input/request';
export type { Requester, RequesterOptions, RequestOptions, ResponseTypes } from './input/request';
export { Archive } from './archive/archive';
export type { ArchiveLimits } from './archive/unzip';
export { parseContainer } from './container/container';
export type { Container } from './container/container';
