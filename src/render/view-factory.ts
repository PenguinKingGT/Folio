/** Allow trusted host view customization while retaining an attached passive iframe contract. */
import { IframeView } from './iframe-view';
import type { ViewOptions } from './iframe-view';
import { validateViewMode } from './view-mode';

/** Factories may subclass the public iframe view to customize native presentation and lifecycle. */
export type ViewFactory = (container: HTMLElement, options: ViewOptions) => IframeView;

/** Validate ownership before a customized view can load publication markup. */
export function createView(container: HTMLElement, options: ViewOptions): IframeView {
  validateViewMode(options.view);
  if (options.createView !== undefined && typeof options.createView !== 'function') {
    throw new TypeError('View factories must be functions.');
  }
  const view =
    options.createView === undefined
      ? new IframeView(container, options)
      : options.createView(container, options);
  if (!(view instanceof IframeView)) {
    throw new TypeError('View factories must return an IframeView instance.');
  }
  try {
    if (
      view.frame.parentNode !== container ||
      view.frame.ownerDocument !== container.ownerDocument ||
      view.frame.getAttribute('sandbox') !== 'allow-same-origin'
    ) {
      throw new TypeError('Custom views require an owned, attached passive iframe.');
    }
    return view;
  } catch (error) {
    view.destroy();
    throw error;
  }
}
