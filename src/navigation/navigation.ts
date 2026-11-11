/** Publication navigation models and lookup independent of rendering. */

/** A nested table-of-contents item; grouping labels may have no link. */
export interface NavigationItem {
  id: string | null;
  label: string;
  href: string | null;
  children: readonly NavigationItem[];
}

/** A semantic publication destination such as cover, toc, or bodymatter. */
export interface Landmark {
  types: readonly string[];
  label: string;
  href: string;
}

/** Preserve directory hierarchy while providing stable ID and href lookup. */
export class Navigation {
  private readonly byId = new Map<string, NavigationItem>();
  private readonly byHref = new Map<string, NavigationItem>();

  /** Index a parsed directory; repeated hrefs select the first occurrence. */
  constructor(
    readonly toc: readonly NavigationItem[],
    readonly landmarks: readonly Landmark[] = [],
  ) {
    const pending = [...toc];
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      if (item === undefined) {
        continue;
      }
      if (item.id !== null) {
        if (this.byId.has(item.id)) {
          throw new TypeError(`Duplicate navigation ID: ${item.id}`);
        }
        this.byId.set(item.id, item);
      }
      if (item.href !== null) {
        const key = decodeURI(item.href);
        if (!this.byHref.has(key)) {
          this.byHref.set(key, item);
        }
      }
      pending.splice(index + 1, 0, ...item.children);
    }
  }

  /** Look up #item-id or an encoded/decoded href; missing targets return null. */
  get(target: string): NavigationItem | null {
    if (target.startsWith('#')) {
      return this.byId.get(target.slice(1)) ?? null;
    }
    return this.byHref.get(decodeURI(target)) ?? null;
  }

  /** Return the first landmark declaring the requested EPUB semantic type. */
  landmark(type: string): Landmark | null {
    return this.landmarks.find((item) => item.types.includes(type)) ?? null;
  }
}
