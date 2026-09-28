export type TourEvent =
  | 'add-opened'
  | 'add-closed'
  | 'amount-entered'
  | 'category-picked'
  | 'transaction-saved';

const listeners = new Set<(event: TourEvent) => void>();

export function emitTourEvent(event: TourEvent) {
  for (const listener of [...listeners]) listener(event);
}

export function onTourEvent(listener: (event: TourEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
