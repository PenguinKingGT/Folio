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
export { ContinuousReader } from './continuous/reader';
export { TouchNavigation } from './touch/navigation';
export { Themes } from './themes/themes';
export { ContentInteractions } from './interaction/interactions';
export { Annotations } from './annotations/annotations';
export type { SearchOptions, SearchMatch } from './search/types';
export type {
  Annotation,
  AnnotationType,
  AnnotationStyle,
  AnnotationOptions,
  AnnotationUpdate,
  AnnotationClick,
} from './annotations/types';
export type {
  ContentSelection,
  ContentInput,
  ContentLink,
  ContentAnchor,
  LinkActivation,
} from './interaction/types';
export type { ThemeRules, ThemeSource, OverrideOptions } from './themes/types';
export type { TouchOptions, TouchSettings } from './touch/options';
export type { ContinuousOptions } from './continuous/options';
export type { RenditionOptions } from './render/rendition';
export type { DisplayTarget } from './render/target';
export type { PageSide } from './layout/fixed-model';
export { fixedGeometry, parseViewport } from './layout/fixed-geometry';
export type { FixedViewport, FixedGeometry } from './layout/fixed-geometry';
export type { FixedLayoutState, RenderedPage } from './render/fixed-spread';
export type { VisibleBoundary, VisibleLocation, RelocatedListener } from './render/location-types';
export { computePagination } from './layout/pagination';
export type { PaginationOptions, PaginationGeometry, PaginationState } from './layout/pagination';
export { resolveFlow } from './layout/flow';
export type { ReadingFlow, FlowMode, ReadingAxis, FlowOptions, FlowState } from './layout/flow';
export type { WritingMode, TextDirection, WritingOptions, WritingState } from './layout/writing';
export { Locations } from './locations/locations';
export { PageList } from './pages/page-list';
export type { PrintPageLink, PrintPage, PrintPageResolver } from './pages/types';
export type {
  LocationOptions,
  LocationUnit,
  LocationLoader,
  ReadingLocation,
  LocationSnapshot,
} from './locations/types';

export type { EventListener } from './events/emitter';
export type { BookEventMap, ReaderEventMap, LocationsEventMap } from './events/types';

export { AsyncHook } from './extensions/hook';
export type { HookCallback } from './extensions/hook';
export { PublicationHooks } from './extensions/publication';
export type {
  SectionContent,
  SectionSerialization,
  ViewContext,
  ManagedReader,
  ReaderFactory,
} from './extensions/types';
export { IframeView } from './render/iframe-view';
export type { ViewOptions } from './render/iframe-view';
export type { ViewFactory } from './render/view-factory';
