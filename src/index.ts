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
export { parsePackage } from './package/package';
export type {
  ManifestItem,
  SpineItem,
  MetadataEntry,
  PackageMetadata,
  PublicationPackage,
} from './package/types';
export { Section } from './spine/section';
export type { SectionLoader } from './spine/section';
export { Spine } from './spine/spine';
export { Cover } from './cover/cover';
export type { CoverLoader } from './cover/cover';
export { Resources } from './resources/resources';
export type { ResourceReader, ResourceOptions } from './resources/resources';
export { resolveResource } from './resources/path';
export type { ResourceAddress } from './resources/path';
export { Navigation } from './navigation/navigation';
export type { NavigationItem, Landmark } from './navigation/navigation';
export { parseNavigation } from './navigation/parse';
export { Book } from './book/book';
export type { BookOptions } from './book/options';
export { Cfi } from './cfi/cfi';
export type { CfiData, CfiPath, CfiStep } from './cfi/types';
export { escapeCfi } from './cfi/syntax';
export { cfiFromNode, cfiFromRange, rangeFromCfi, nodeFromCfi } from './cfi/dom';
export type { CfiDomOptions } from './cfi/dom';
export { Rendition } from './render/rendition';
export type { RenditionOptions } from './render/rendition';
export { computePagination } from './layout/pagination';
export type { PaginationOptions, PaginationGeometry, PaginationState } from './layout/pagination';
export { resolveFlow } from './layout/flow';
export type { ReadingFlow, FlowMode, ReadingAxis, FlowOptions, FlowState } from './layout/flow';
export { Locations } from './locations/locations';
export type {
  LocationOptions,
  LocationUnit,
  LocationLoader,
  ReadingLocation,
  LocationSnapshot,
} from './locations/types';
