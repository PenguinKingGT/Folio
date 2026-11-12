/** Bridge existing reader subscriptions into one typed public interface with owned cleanup. */
import { EventEmitter } from './emitter';
import { isAbortError } from '../async/lifecycle';
import type { ReaderEventMap } from './types';
import type { Section } from '../spine/section';
import type { RelocatedListener } from '../render/location-types';
import type { ContentInteractions } from '../interaction/interactions';
import type { Annotations } from '../annotations/annotations';

/** Both native reader implementations expose these existing observer seams. */
interface ReaderSubscriptions {
  readonly interactions: ContentInteractions;
  readonly annotations: Annotations;
  onRelocated(listener: RelocatedListener): () => void;
  onError?(listener: (error: unknown) => void): () => void;
}

/** Reader-owned forwarding is detached before content subsystems are destroyed. */
export class ReaderEvents extends EventEmitter<ReaderEventMap> {
  private readonly releases: (() => void)[] = [];

  /** Connect after all native subsystems have been constructed; this performs no chapter I/O. */
  protected connectEvents(reader: ReaderSubscriptions): void {
    this.releases.push(
      reader.onRelocated((location) => this.emit('relocated', location)),
      reader.interactions.onSelection((selection) => this.emit('selected', selection)),
      reader.interactions.onInput((input) => this.emit('input', input)),
      reader.interactions.onLink((link) => this.emit('link', link)),
      reader.interactions.onError((error) => this.emit('error', error)),
      reader.annotations.onClick((click) => this.emit('annotationClick', click)),
      reader.annotations.onError((error) => this.emit('error', error)),
    );
    if (reader.onError !== undefined) {
      this.releases.push(reader.onError((error) => this.emit('error', error)));
    }
  }

  /** Observe display completion; continuous navigation already publishes its own background failures. */
  protected async displayEvent(
    operation: () => Promise<Section>,
    reportErrors = true,
  ): Promise<Section> {
    let section: Section;
    try {
      section = await operation();
    } catch (error) {
      if (reportErrors && !isAbortError(error)) {
        this.emit('error', error);
      }
      throw error;
    }
    this.emit('displayed', section);
    return section;
  }

  /** Remove bridge subscriptions and release all public callbacks after final destruction notification. */
  protected destroyEvents(): void {
    for (const release of this.releases.splice(0)) {
      release();
    }
    this.finishEvents('destroyed', undefined);
  }
}
