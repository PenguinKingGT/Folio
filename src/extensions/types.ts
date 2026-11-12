/** Explicit extension contexts separate headless XML mutation from native view work and custom reader ownership. */
import type { Document as XmlDocument } from '@xmldom/xmldom';
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import type { DisplayTarget } from '../render/target';
import type { RenderedPage } from '../render/fixed-spread';

/** Content callbacks run once per successful lazy chapter load before its DOM is cached. */
export interface SectionContent {
  readonly section: Section;
  readonly document: XmlDocument;
}

/** Serialization callbacks may replace source; mutations remain local to this render operation. */
export interface SectionSerialization extends SectionContent {
  source: string;
}

/** Native render/unload contexts retain the actual frame, DOM, and reading-order identity. */
export type ViewContext = RenderedPage;

/** A custom manager must expose chapter navigation, native contents, and deterministic cleanup. */
export interface ManagedReader {
  display(target?: DisplayTarget): Promise<Section>;
  getContents(): Document | null;
  destroy(): void;
}

/** Factories run only when explicitly invoked by the host; EPUB content cannot register extensions. */
export type ReaderFactory<Options, Reader extends ManagedReader> = (
  book: Book,
  target: HTMLElement | string,
  options: Options,
) => Reader;
