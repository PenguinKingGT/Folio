/** Trusted failure probes verify that native owners complete cleanup independently of extension cooperation. */
import { IframeView } from '../../../src/index';
import type { ViewOptions } from '../../../src/index';

/** Deliberately violate the host view's cleanup contract so the library must still release its own ownership. */
export class FailingView extends IframeView {
  /** Retain a destruction probe outside the failed extension instance. */
  constructor(
    container: HTMLElement,
    options: ViewOptions,
    private readonly count: () => void,
  ) {
    super(container, options);
  }
  /** Throw before native removal to test owner-level finally cleanup rather than cooperative extension behavior. */
  override destroy(): void {
    this.count();
    throw new Error('Original custom view cleanup');
  }
}
