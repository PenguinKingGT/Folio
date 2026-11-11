/** Resolve reader flow modes and axes independently of a browser view. */
export type ReadingFlow = 'paginated' | 'scrolled-doc' | 'scrolled-continuous';
export type FlowMode = ReadingFlow | 'auto';
export type ReadingAxis = 'horizontal' | 'vertical';

/** Explicit settings override OPF flow; auto uses recognized publication metadata. */
export interface FlowOptions {
  flow?: FlowMode;
  axis?: ReadingAxis;
}

/** Measured logical scroll extent for the current chapter and flow. */
export interface FlowState {
  readonly flow: ReadingFlow;
  readonly axis: ReadingAxis;
  readonly length: number;
  readonly viewport: number;
}

/** Resolve supported modes and reject unsupported axes instead of silently ignoring them. */
export function resolveFlow(
  options: FlowOptions = {},
  metadata?: string,
): { flow: ReadingFlow; axis: ReadingAxis } {
  const requested = options.flow ?? 'auto';
  if (!['auto', 'paginated', 'scrolled-doc', 'scrolled-continuous'].includes(requested)) {
    throw new TypeError('Unsupported reading flow.');
  }
  let flow: ReadingFlow = 'paginated';
  if (requested !== 'auto') {
    flow = requested;
  } else if (metadata === 'scrolled-doc' || metadata === 'scrolled-continuous') {
    flow = metadata;
  }
  const axis = options.axis ?? (flow === 'paginated' ? 'horizontal' : 'vertical');
  if (axis !== 'horizontal' && axis !== 'vertical') {
    throw new TypeError('Unsupported reading axis.');
  }
  if (flow === 'paginated' && axis !== 'horizontal') {
    throw new TypeError('Vertical pagination requires vertical writing support (F19).');
  }
  return { flow, axis };
}
