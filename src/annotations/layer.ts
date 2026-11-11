/** Own a host SVG overlay without adding annotation wrappers to the publication DOM. */
import type { DrawnAnnotation } from './geometry';
import { paintAnnotation } from './paint';

const svg = 'http://www.w3.org/2000/svg';

/** Keyed groups preserve focus and avoid rewriting unchanged geometry on every native scroll notification. */
export class AnnotationLayer {
  readonly element: SVGSVGElement;
  private readonly controller = new AbortController();
  private readonly groups = new Map<string, { element: SVGGElement; signature: string }>();

  /** Attach only to the reader's positioned surface; click handlers execute in the host document. */
  constructor(
    surface: HTMLElement,
    clicked: (id: string, event: MouseEvent | KeyboardEvent) => void,
  ) {
    this.element = surface.ownerDocument.createElementNS(svg, 'svg');
    this.element.setAttribute('data-folio-annotations', '');
    this.element.setAttribute('aria-label', 'Reading annotations');
    this.element.setAttribute('role', 'group');
    this.element.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:1;';
    surface.appendChild(this.element);
    const options = { signal: this.controller.signal };
    this.element.addEventListener(
      'click',
      (event) => {
        if (event.button === 0) {
          this.activate(event, clicked);
        }
      },
      options,
    );
    this.element.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' && !event.repeat) {
          this.activate(event, clicked);
        }
        if (event.key === ' ') {
          event.preventDefault();
        }
      },
      options,
    );
    this.element.addEventListener(
      'keyup',
      (event) => {
        if (event.key === ' ') {
          this.activate(event, clicked);
        }
      },
      options,
    );
  }

  /** Resolve a current annotation group without trusting metadata outside this owned layer. */
  private activate(
    event: MouseEvent | KeyboardEvent,
    clicked: (id: string, event: MouseEvent | KeyboardEvent) => void,
  ): void {
    const realm = this.element.ownerDocument.defaultView;
    const target =
      realm !== null && event.target instanceof realm.Element
        ? event.target.closest('[data-folio-annotation]')
        : null;
    const id = target?.getAttribute('data-folio-annotation');
    if (id !== undefined && id !== null) {
      const group = this.groups.get(id);
      if (
        group !== undefined &&
        group.element === target &&
        group.element.style.pointerEvents !== 'none'
      ) {
        event.preventDefault();
        clicked(id, event);
      }
    }
  }

  /** Remove trimmed registrations while retaining groups whose clipped geometry remains stable. */
  render(drawings: readonly DrawnAnnotation[], width: number, height: number): void {
    this.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const kept = new Set(drawings.map((drawing) => drawing.annotation.id));
    for (const [id, group] of this.groups) {
      if (!kept.has(id)) {
        group.element.remove();
        this.groups.delete(id);
      }
    }
    for (const drawing of drawings) {
      const id = drawing.annotation.id;
      const signature = JSON.stringify({
        type: drawing.annotation.type,
        label: drawing.annotation.label,
        interactive: drawing.annotation.interactive,
        style: drawing.annotation.style,
        boxes: drawing.boxes,
        vertical: drawing.vertical,
      });
      let group = this.groups.get(id);
      if (group === undefined) {
        group = { element: this.element.ownerDocument.createElementNS(svg, 'g'), signature: '' };
        this.groups.set(id, group);
        this.element.appendChild(group.element);
      }
      if (group.signature !== signature) {
        paintAnnotation(group.element, drawing);
        group.signature = signature;
      }
    }
  }

  /** Hide without discarding registrations or detached native CFI targets. */
  show(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }

  /** Release native input callbacks and all host SVG nodes; safe to repeat. */
  destroy(): void {
    this.controller.abort();
    this.groups.clear();
    this.element.remove();
  }
}
