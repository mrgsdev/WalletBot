import { splitMoney } from '../lib/format';

/**
 * Сумма в стиле редизайна: символ валюты меньше и приподнят, копейки
 * приглушены. Так крупный баланс читается за одно движение глаза —
 * рубли берут на себя вес, копейки не спорят с ними за внимание.
 *
 * Размер задаётся снаружи (`className`), внутренние части считаются в `em`,
 * поэтому один компонент работает и для баланса на 40px, и для строки списка.
 */
export function Money({
  value,
  currency,
  alwaysCents = false,
  sign,
  className = '',
  centsClassName = '',
}: {
  value: number;
  currency: string;
  /** Показывать копейки, даже когда они нулевые. */
  alwaysCents?: boolean;
  /** Переопределяет знак: '+' для дохода, '' чтобы убрать минус у перевода. */
  sign?: string;
  className?: string;
  centsClassName?: string;
}) {
  const parts = splitMoney(value, currency, alwaysCents);
  const prefix = sign ?? parts.sign;

  return (
    <span className={`tabular ${className}`}>
      {prefix}
      <span className="mr-[0.06em] align-super text-[0.58em] opacity-50">{parts.symbol}</span>
      {parts.int}
      {parts.cents && <span className={`opacity-40 ${centsClassName}`}>{parts.cents}</span>}
    </span>
  );
}
