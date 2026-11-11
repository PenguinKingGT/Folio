/** Create host SVG shapes from validated annotation styles and clipped geometry. */
import type { DrawnAnnotation } from './geometry';
import type { AnnotationBox } from './boxes';

const svg = 'http://www.w3.org/2000/svg';

/** Underlines follow the text axis: bottom for horizontal text, right edge for vertical text. */
function underline(document: Document, box: AnnotationBox, drawn: DrawnAnnotation): SVGLineElement {
  const line = document.createElementNS(svg, 'line');
  const thickness = drawn.annotation.style.thickness;
  const x = drawn.vertical ? box.x + box.width - thickness / 2 : box.x;
  const y = drawn.vertical ? box.y : box.y + box.height - thickness / 2;
  line.setAttribute('x1', String(x));
  line.setAttribute('y1', String(y));
  line.setAttribute('x2', String(drawn.vertical ? x : box.x + box.width));
  line.setAttribute('y2', String(drawn.vertical ? box.y + box.height : y));
  line.setAttribute('stroke', drawn.annotation.style.color);
  line.setAttribute('stroke-width', String(thickness));
  return line;
}

/** Highlights and mark badges use filled rectangles; marks have rounded corners. */
function rectangle(document: Document, box: AnnotationBox, drawn: DrawnAnnotation): SVGRectElement {
  const rect = document.createElementNS(svg, 'rect');
  rect.setAttribute('x', String(box.x));
  rect.setAttribute('y', String(box.y));
  rect.setAttribute('width', String(box.width));
  rect.setAttribute('height', String(box.height));
  rect.setAttribute('fill', drawn.annotation.style.color);
  if (drawn.annotation.type === 'mark') {
    rect.setAttribute('rx', String(box.width / 2));
  }
  return rect;
}

/** Preserve the keyed group while refreshing its shapes so active/focused annotations keep their identity. */
export function paintAnnotation(group: SVGGElement, drawn: DrawnAnnotation): void {
  const { annotation } = drawn;
  group.setAttribute('data-folio-annotation', annotation.id);
  group.setAttribute('data-annotation-type', annotation.type);
  group.setAttribute('opacity', String(annotation.style.opacity));
  group.style.pointerEvents = annotation.interactive ? 'auto' : 'none';
  if (annotation.interactive) {
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', annotation.label);
  } else {
    group.removeAttribute('tabindex');
    group.removeAttribute('role');
    group.removeAttribute('aria-label');
  }
  const title = group.ownerDocument.createElementNS(svg, 'title');
  title.textContent = annotation.label;
  const shapes = drawn.boxes.map((box) =>
    annotation.type === 'underline'
      ? underline(group.ownerDocument, box, drawn)
      : rectangle(group.ownerDocument, box, drawn),
  );
  group.replaceChildren(title, ...shapes);
}
