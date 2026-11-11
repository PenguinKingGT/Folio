/** Serialize latest-intent theme mutations without leaving rejected background promises unobserved. */

/** Cancellation stops obsolete consumers; publication resources keep their own shared ownership. */
export class ThemeTasks {
  private controller: AbortController | undefined;
  private pending: Promise<void> = Promise.resolve();
  private destroyed = false;
  version = 0;

  /** Start a mutation after cancelling the previous request and invalidating its revision. */
  run(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('Themes have been destroyed.'));
    }
    this.controller?.abort();
    this.controller = new AbortController();
    this.version += 1;
    this.pending = task(this.controller.signal);
    void this.pending.catch(() => {});
    return this.pending;
  }

  /** Follow superseding requests rather than failing on an obsolete operation's cancellation. */
  async whenIdle(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.pending;
      try {
        await pending;
      } catch (error) {
        if (pending === this.pending) {
          throw error;
        }
      }
    } while (pending !== this.pending);
  }

  /** New chapters can use the last valid theme even after a rejected registration attempt. */
  async settled(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.pending;
      await Promise.allSettled([pending]);
    } while (pending !== this.pending);
  }

  /** Abort pending mutations and reject future ones; safe to repeat. */
  destroy(): void {
    this.destroyed = true;
    this.controller?.abort();
  }
}
