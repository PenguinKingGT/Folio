/** Publication package models shared by parsers and loading modules. */

/** A manifest resource; href remains relative to the OPF document. */
export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: readonly string[];
  fallback: string | null;
  mediaOverlay: string | null;
}

/** Reading order preserves non-linear entries for explicit navigation. */
export interface SpineItem {
  idref: string;
  index: number;
  linear: boolean;
  properties: readonly string[];
}

/** Preserve EPUB 2 name/content and EPUB 3 property/refines metadata. */
export interface MetadataEntry {
  name: string;
  value: string;
  id: string | null;
  refines: string | null;
}

/** Dublin Core fields plus unflattened extension metadata. */
export interface PackageMetadata {
  /** Every direct Dublin Core value grouped by local name, retaining repetitions and source order. */
  dublinCore: Readonly<Record<string, readonly string[]>>;
  title: string;
  creators: readonly string[];
  language: string;
  identifier: string;
  description: string;
  publisher: string;
  date: string;
  rights: string;
  entries: readonly MetadataEntry[];
}

/** Validated package structure, with unresolved paths and publication-wide defaults. */
export interface PublicationPackage {
  version: string;
  metadata: PackageMetadata;
  manifest: ReadonlyMap<string, ManifestItem>;
  spine: readonly SpineItem[];
  spineStep: number;
  direction: 'ltr' | 'rtl' | 'default';
  rendition: Readonly<Record<string, string>>;
  navPath: string | null;
  ncxPath: string | null;
  coverPath: string | null;
}
