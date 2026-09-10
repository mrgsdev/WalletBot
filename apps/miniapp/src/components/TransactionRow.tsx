import { ArrowLeftRight } from 'lucide-react';
import type { TransactionDto } from '@budget/shared';
import { Money } from './Money';
import { formatDateLabel } from '../lib/format';
import { tg } from '../lib/telegram';

/**
 * Строка операции в истории и на главном экране.
 *
 * Редизайн: иконка — скруглённый квадрат (читается как иконка приложения),
 * в подписи появилась дата, копейки в сумме приглушены.
 */
export function TransactionRow({
  transaction,
  onClick,
  showAuthor = false,
  showDate = false,
}: {
  transaction: TransactionDto;
  onClick?: () => void;
  showAuthor?: boolean;
  /** На главной дату показываем в строке — там нет заголовков групп по дням. */
  showDate?: boolean;
}) {
  const isTransfer = transaction.type === 'transfer';
  const isIncome = transaction.type === 'income';

  const sign = isTransfer ? '' : isIncome ? '+' : '−';
  const amountColor = isTransfer ? 'text-muted' : isIncome ? 'text-positive' : 'text-content';

  const title = isTransfer
    ? `${transaction.accountName} → ${transaction.toAccountName ?? '—'}`
    : transaction.categoryName ?? 'Без категории';

  const subtitleParts = [
    isTransfer ? 'Перевод' : transaction.accountName,
    showDate ? formatDateLabel(transaction.date) : null,
    transaction.comment,
  ].filter(Boolean);

  // В семейном бюджете автора показываем аватаром на иконке категории:
  // имя в подписи вытесняло счёт, а аватар узнаётся с одного взгляда.
  const author = showAuthor ? transaction.userName : null;

  return (
    <button
      type="button"
      onClick={() => {
        if (!onClick) return;
        tg.haptic.light();
        onClick();
      }}
      className="flex w-full items-center gap-3 py-3 text-left"
    >
      <span className="relative shrink-0">
        <span
          className="squircle h-11 w-11 text-[19px]"
          style={{
            backgroundColor: isTransfer
              ? 'rgb(var(--c-elevated))'
              : `${transaction.categoryColor ?? '#8E8E93'}24`,
          }}
        >
          {isTransfer ? <ArrowLeftRight size={18} className="text-muted" /> : transaction.categoryIcon ?? '🏷'}
        </span>

        {author && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full bg-elevated text-[9px] font-bold ring-2 ring-card"
            title={author}
          >
            {transaction.userAvatarUrl ? (
              <img src={transaction.userAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              author[0]?.toUpperCase()
            )}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-muted">{subtitleParts.join(' · ')}</span>
      </span>

      <span className="shrink-0 text-right">
        <Money
          value={transaction.convertedAmount}
          currency={transaction.accountCurrency}
          sign={sign}
          className={`block text-[15px] font-semibold ${amountColor}`}
        />
        {transaction.currency !== transaction.accountCurrency && (
          <Money
            value={transaction.amount}
            currency={transaction.currency}
            className="block text-[12px] text-muted"
          />
        )}
      </span>
    </button>
  );
}
