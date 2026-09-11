import { splitMoney } from '../lib/format';

/**
 * Сумма в стиле редизайна: символ валюты того же кегля, что и число,
 * приглушены только копейки. Так крупный баланс читается за одно движение
 * глаза — рубли берут на себя вес, копейки не спорят с ними за внимание.
 *
 * Размер задаётся снаружи (`className`), приглушение копеек — в `em`-долях,
 * поэтому один компонент работает и для баланса на 42px, и для строки списка.
 */
export function Money({
  value,
  currency,
  alwaysCents = false,
  sign,
  symbolSide = 'left',
  className = '',
  centsClassName = '',
}: {
  value: number;
  currency: string;
  /** Показывать копейки, даже когда они нулевые. */
  alwaysCents?: boolean;
  /** Переопределяет знак: '+' для дохода, '' чтобы убрать минус у перевода. */
  sign?: string;
  /**
   * Где стоит символ валюты. Слева — для крупных «геройских» сумм, справа —
   * для списков: «500 ₽» это привычный русскому глазу порядок.
   */
  symbolSide?: 'left' | 'right';
  className?: string;
  centsClassName?: string;
}) {
  const parts = splitMoney(value, currency, alwaysCents);
  const prefix = sign ?? parts.sign;

  return (
    <span className={`tabular ${className}`}>
      {prefix}
      {symbolSide === 'left' && parts.symbol}
      {parts.int}
      {parts.cents && <span className={`opacity-40 ${centsClassName}`}>{parts.cents}</span>}
      {symbolSide === 'right' && <span className="ml-[0.18em]">{parts.symbol}</span>}
    </span>
  );
}
