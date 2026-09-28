import { splitMoney } from '../lib/format';

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

  alwaysCents?: boolean;

  sign?: string;

  symbolSide?: 'left' | 'right';
  className?: string;
  centsClassName?: string;
}) {
  const parts = splitMoney(value, currency, alwaysCents);
  const prefix = sign ?? parts.sign;

  return (
    <span className={`tabular whitespace-nowrap ${className}`}>
      {prefix}
      {symbolSide === 'left' && parts.symbol}
      {parts.int}
      {parts.cents && <span className={`opacity-40 ${centsClassName}`}>{parts.cents}</span>}
      {symbolSide === 'right' && <span className="ml-[0.18em]">{parts.symbol}</span>}
    </span>
  );
}
