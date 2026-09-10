/**
 * Шина событий для интерактивного обучения.
 *
 * Интерактивные шаги ждут реального действия пользователя. Проверять это
 * по DOM хрупко, поэтому экраны сами сообщают о ключевых моментах.
 */

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
