/** Public loading options composed from the input, transport, and resource boundaries. */
import type { OfflineStore } from '../offline/store';
import type { ArchiveLimits } from '../archive/unzip';
import type { RequesterOptions } from '../input/request';
import type { InputOptions } from '../input/source';
import type { ResourceOptions } from '../resources/resources';

/** Configure loading without creating a browser view. */
export interface BookOptions extends InputOptions, RequesterOptions, ResourceOptions {
  archiveLimits?: ArchiveLimits;
  offline?: OfflineStore;
}
