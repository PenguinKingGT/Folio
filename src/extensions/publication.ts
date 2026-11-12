/** Own publication-wide extension pipelines and observable asynchronous view-unload work. */
import { AsyncHook } from './hook';
import type { SectionContent, SectionSerialization, ViewContext } from './types';
import { isAbortError } from '../events/errors';

/** Views detach synchronously; unload callbacks can finish asynchronously through whenIdle(). */
export class PublicationHooks {
  readonly content = new AsyncHook<SectionContent>();
  readonly serialize = new AsyncHook<SectionSerialization>();
  readonly render = new AsyncHook<ViewContext>();
  readonly unload = new AsyncHook<ViewContext>();
  private readonly pending = new Set<Promise<void>>();
  private readonly failures: unknown[] = [];
  private destroyed = false;

  /** Retain the native context until its asynchronous cleanup settles, without delaying frame removal. */
  release(context: ViewContext): void {
    if (this.destroyed) {
      return;
    }
    const operation = this.unload.run(context);
    const settled = operation.then(
      () => {
        this.pending.delete(settled);
      },
      (error: unknown) => {
        this.pending.delete(settled);
        if (!isAbortError(error)) {
          this.failures.push(error);
        }
      },
    );
    this.pending.add(settled);
  }

  /** Drain unload callbacks, including work queued while waiting; report and consume retained failures. */
  async whenIdle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all(Array.from(this.pending));
    }
    if (this.failures.length > 0) {
      throw new AggregateError(this.failures.splice(0), 'Extension unload callbacks failed.');
    }
  }

  /** Cancel unawaited extension work and release callbacks when synchronous book cleanup is requested. */
  destroy(): void {
    this.destroyed = true;
    this.content.destroy();
    this.serialize.destroy();
    this.render.destroy();
    this.unload.destroy();
  }
}
