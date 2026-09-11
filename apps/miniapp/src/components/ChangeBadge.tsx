import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/**
 * Изменение к предыдущему периоду.
 *
 * Цвет зависит от смысла, а не от знака: рост расходов — плохо,
 * рост доходов — хорошо. Поэтому нужен тип операции.
 */
export function ChangeBadge({
  percent,
  type,
  size = 'sm',
}: {
  percent: number | null;
  type: 'income' | 'expense';
  size?: 'sm' | 'md';
}) {
  // Сравнивать не с чем — прошлый период был пустым.
  if (percent === null) return null;

  const rounded = Math.round(percent);
  const flat = rounded === 0;
  const up = rounded > 0;

  // Для расходов рост — тревожный сигнал, для доходов — наоборот.
  const good = type === 'income' ? up : !up;
  const color = flat ? 'text-muted' : good ? 'text-positive' : 'text-negative';

  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text = size === 'md' ? 'text-[13px]' : 'text-[11px]';
  const icon = size === 'md' ? 14 : 11;

  return (
    <span className={`tabular inline-flex items-center gap-0.5 font-medium ${color} ${text}`}>
      <Icon size={icon} strokeWidth={2.5} />
      {flat ? 'без изменений' : formatPercent(Math.abs(rounded))}
    </span>
  );
}

/**
 * Потолок для процентов.
 *
 * При пустом прошлом периоде рост считается от почти нуля и даёт
 * значения вроде 40 597 596 606 % — такая строка ломает строку списка,
 * а смысла в точной цифре нет: это просто «очень много».
 */
function formatPercent(value: number): string {
  if (value > 999) return '>999%';
  return `${value}%`;
}
