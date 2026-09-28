import { MONTHS_NOM, MONTHS_SHORT } from './format';

export type PeriodKind = 'week' | 'month' | 'quarter';

export interface PeriodTab {
  key: string;
  label: string;

  anchor: Date;
}

export function buildPeriodTabs(kind: PeriodKind, count = 12): PeriodTab[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const tabs: PeriodTab[] = [];

  if (kind === 'month') {
    for (let i = count - 1; i >= 0; i--) {
      const anchor = new Date(Date.UTC(year, month - i, 15, 12));
      const y = anchor.getUTCFullYear();
      const m = anchor.getUTCMonth();
      tabs.push({
        key: `${y}-${m}`,
        label: y === year ? MONTHS_NOM[m] : `${MONTHS_SHORT[m]} ${String(y).slice(2)}`,
        anchor,
      });
    }
    return tabs;
  }

  if (kind === 'quarter') {
    const currentQuarter = Math.floor(month / 3);
    for (let i = 5; i >= 0; i--) {
      const anchor = new Date(Date.UTC(year, (currentQuarter - i) * 3 + 1, 15, 12));
      const y = anchor.getUTCFullYear();
      const q = Math.floor(anchor.getUTCMonth() / 3);
      tabs.push({
        key: `${y}-q${q}`,
        label: `${q + 1} кв. ${String(y).slice(2)}`,
        anchor,
      });
    }
    return tabs;
  }

  const dayOfWeek = (now.getDay() + 6) % 7;
  for (let i = 7; i >= 0; i--) {
    const monday = new Date(Date.UTC(year, month, now.getDate() - dayOfWeek - i * 7, 12));
    const thursday = new Date(monday.getTime() + 3 * 24 * 3600_000);
    const sunday = new Date(monday.getTime() + 6 * 24 * 3600_000);
    tabs.push({
      key: `w-${monday.toISOString().slice(0, 10)}`,
      label:
        i === 0
          ? 'Эта неделя'
          : `с ${monday.getUTCDate()} по ${sunday.getUTCDate()} ${MONTHS_SHORT[
              sunday.getUTCMonth()
            ].toLowerCase()}`,
      anchor: thursday,
    });
  }
  return tabs;
}
