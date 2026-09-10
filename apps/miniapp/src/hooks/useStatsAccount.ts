import { useEffect } from 'react';
import { useAccounts } from '../lib/queries';
import { useAppStore } from '../store/app';

/**
 * Фильтр счёта для статистики с защитой от «мёртвой» ссылки.
 *
 * Выбранный счёт лежит в localStorage и переживает удаление счёта,
 * очистку демо-данных и смену бюджета. После этого запрос уходил с id,
 * которого больше нет: сервер честно возвращал пустой результат, а экран
 * показывал «Пока нет данных», хотя в заголовке значилось «Все счета».
 *
 * Поэтому при загруженном списке счетов проверяем ссылку и сбрасываем её.
 */
export function useStatsAccount(): number | null {
  const accountId = useAppStore((s) => s.statsAccountId);
  const setAccountId = useAppStore((s) => s.setStatsAccountId);
  const { data: accounts, isSuccess } = useAccounts();

  const exists = accountId !== null && (accounts?.some((a) => a.id === accountId) ?? false);

  useEffect(() => {
    // Сбрасываем только когда список действительно загружен,
    // иначе на первом рендере снесли бы валидный выбор.
    if (isSuccess && accountId !== null && !exists) setAccountId(null);
  }, [isSuccess, accountId, exists, setAccountId]);

  // До сброса не даём запросу уйти с несуществующим счётом.
  return exists ? accountId : null;
}
