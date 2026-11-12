/** Move the continuous viewport in logical reading order while respecting pending native reconciliation. */
import type { ContinuousReader } from './reader';
import type { ContinuousNavigation } from './navigation';
import type { ContinuousPort } from './port';
import type { ContinuousWindow } from './window';
import type { Section } from '../spine/section';
import type { FlowState } from '../layout/flow';
import { scrollToPosition } from './position';

/** Commit native movement before synchronizing the bounded view window and awaiting background work. */
export async function turnContinuous(
  reader: ContinuousReader,
  navigation: ContinuousNavigation,
  port: ContinuousPort,
  window: ContinuousWindow,
  active: boolean,
  delta: 1 | -1,
  report: () => void,
): Promise<Section | null> {
  if (!active) {
    return reader.display();
  }
  await reader.whenIdle();
  const position = continuousTurnPosition(port.offset(), reader.flowState, delta);
  if (position === null) {
    return null;
  }
  scrollToPosition(port, window, position);
  report();
  navigation.sync();
  await reader.whenIdle();
  return reader.currentSection;
}

/** Clamp a viewport step to measured reading bounds; absent geometry and unchanged edges cannot turn. */
export function continuousTurnPosition(
  before: number,
  state: FlowState | null,
  delta: 1 | -1,
): number | null {
  if (state === null) {
    return null;
  }
  const position = Math.max(
    0,
    Math.min(Math.max(0, state.length - state.viewport), before + state.viewport * delta),
  );
  return Math.abs(position - before) <= 1 ? null : position;
}
