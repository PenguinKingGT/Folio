/** Resolve authored writing modes and normalize the scroll root without changing CFI structure. */
import type { ReadingAxis, ReadingFlow } from './flow';

export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
export type TextDirection = 'ltr' | 'rtl';

/** Explicit reader overrides take precedence over publication and authored typography. */
export interface WritingOptions {
  direction?: TextDirection | 'auto';
  writingMode?: WritingMode | 'auto';
}

/** Native inline/block progression determines the scroll axis and coordinate sign. */
export interface WritingState {
  readonly writingMode: WritingMode;
  readonly direction: TextDirection;
  readonly axis: ReadingAxis;
  readonly reverse: boolean;
}

/** One injected declaration records enough information to restore author media-query behavior. */
interface Declaration {
  value: string;
  priority: string;
  applied: string;
}

/** Apply defaults while retaining author direction and body-only vertical declarations. */
export class WritingLayout {
  private readonly injected = new WeakMap<Document, Map<string, Declaration>>();

  /** Reject unsupported overrides before allocating browser views. */
  constructor(
    private readonly options: WritingOptions = {},
    private readonly fallback = 'default',
  ) {
    if (
      !['auto', 'ltr', 'rtl'].includes(options.direction ?? 'auto') ||
      !['auto', 'horizontal-tb', 'vertical-rl', 'vertical-lr'].includes(
        options.writingMode ?? 'auto',
      )
    ) {
      throw new TypeError('Unsupported direction or writing mode.');
    }
  }

  /** Resolve typography afresh on every layout so author media queries can change it. */
  apply(document: Document, flow: ReadingFlow, requested?: ReadingAxis): WritingState {
    const root = document.documentElement;
    this.restore(document);
    if (!root.hasAttribute('dir') && this.fallback !== 'default') {
      root.setAttribute('dir', this.fallback);
    }
    this.override(document, 'direction', this.options.direction);
    this.override(document, 'writing-mode', this.options.writingMode);
    const style = document.defaultView?.getComputedStyle(document.body);
    const value = style?.writingMode ?? 'horizontal-tb';
    if (value !== 'horizontal-tb' && value !== 'vertical-rl' && value !== 'vertical-lr') {
      throw new TypeError(`Unsupported authored writing mode: ${value}`);
    }
    const direction = style?.direction === 'rtl' ? 'rtl' : 'ltr';
    this.alignRoot(document, 'writing-mode', value);
    this.alignRoot(document, 'direction', direction);
    const inline = value === 'horizontal-tb' ? 'horizontal' : 'vertical';
    const block = inline === 'horizontal' ? 'vertical' : 'horizontal';
    const axis = requested ?? (flow === 'paginated' ? inline : block);
    if (flow === 'paginated' && axis !== inline) {
      throw new TypeError('Pagination axis must match the writing mode inline axis.');
    }
    return Object.freeze({
      writingMode: value,
      direction,
      axis,
      reverse: axis === inline ? direction === 'rtl' : value === 'vertical-rl',
    });
  }

  /** Ignore transient native scrolls while author typography has changed but layout is still pending. */
  matches(document: Document, state: WritingState): boolean {
    const style = document.defaultView?.getComputedStyle(document.body);
    return style?.writingMode === state.writingMode && style.direction === state.direction;
  }

  /** Explicit overrides also apply to the body when author CSS declares its own typography. */
  private override(document: Document, property: string, value?: string): void {
    if (value !== undefined && value !== 'auto') {
      document.documentElement.style.setProperty(property, value, 'important');
      document.body.style.setProperty(property, value, 'important');
    }
  }

  /** Match scrollport progression to body layout, including body-only author styles. */
  private alignRoot(document: Document, property: string, value: string): void {
    const root = document.documentElement;
    if (document.defaultView?.getComputedStyle(root).getPropertyValue(property) === value) {
      return;
    }
    const declarations = this.injected.get(document) ?? new Map<string, Declaration>();
    declarations.set(property, {
      value: root.style.getPropertyValue(property),
      priority: root.style.getPropertyPriority(property),
      applied: value,
    });
    this.injected.set(document, declarations);
    root.style.setProperty(property, value, 'important');
  }

  /** Remove only still-owned declarations before computing author styles for the next layout. */
  private restore(document: Document): void {
    const root = document.documentElement;
    for (const [property, declaration] of this.injected.get(document) ?? []) {
      if (root.style.getPropertyValue(property) === declaration.applied) {
        root.style.setProperty(property, declaration.value, declaration.priority);
      }
    }
    this.injected.delete(document);
  }
}
