import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { AccountDto } from '@budget/shared';
import { CURRENCIES, currencySymbol } from '@budget/shared';
import { ACCOUNT_ICON_IMAGES, AccountIcon } from '../components/AccountIcon';
import { Sheet } from '../components/Sheet';
import { EmptyState, ErrorState, ListRow, PrimaryButton, Skeleton } from '../components/ui';
import { BudgetSwitcher } from '../components/BudgetSwitcher';
import { TourTarget } from '../components/Tour';
import { groupByCurrency } from '../components/CurrencyBreakdown';
import { useAccounts, useDeleteAccount, useRates, useSaveAccount, useSession } from '../lib/queries';
import { totalBalance } from '../lib/balance';
import { fontSizeForLength, formatMoney } from '../lib/format';
import { useIsFamilyBudget } from '../hooks/useCurrentBudget';
import { useMainButton } from '../hooks/useMainButton';
import { tg } from '../lib/telegram';

// Порядок = порядок в наборе объёмных иконок из AccountIcon.
const ICONS = ['💳', '💵', '💰', '🪙', '🥇', '🔐', '👛', '💼', '🧳', '🏦', '🐖', '🛍'];
const COLORS = ['#6EC1FF', '#7ED97E', '#B57BFF', '#FF9F6E', '#FF6E8A', '#E6E86E', '#5B5BD6', '#7EE8C6'];

/** Экран «Кошелёк»: счета, их балансы и переводы между ними. */
export function WalletScreen({ onTransfer }: { onTransfer: () => void }) {
  const isFamily = useIsFamilyBudget();
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const { data: session } = useSession();
  const baseCurrency = session?.settings.baseCurrency ?? 'RUB';
  const { data: rates } = useRates(baseCurrency);

  const [editing, setEditing] = useState<AccountDto | null>(null);
  const [creating, setCreating] = useState(false);

  const total = totalBalance(accounts, baseCurrency, rates);
  const groups = useMemo(
    () => groupByCurrency(accounts, baseCurrency, rates),
    [accounts, baseCurrency, rates],
  );

  return (
    <div className="pb-28">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[calc(10px+var(--safe-top))]">
        <BudgetSwitcher />
        <TourTarget id="wallet-add">
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              setCreating(true);
            }}
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
            aria-label="Новый счёт"
          >
            <Plus size={20} />
          </button>
        </TourTarget>
      </header>

      <TourTarget id="wallet-total" className="px-5 pb-4 pt-2">
        <div className="text-[13px] text-muted">Всего на счетах</div>
        <div
          className="tabular font-bold leading-tight"
          /* Кегль под длину: крупный итог иначе уезжает за край. */
          style={{
            fontSize: fontSizeForLength(formatMoney(total, baseCurrency, true), 34, 15, 18),
          }}
        >
          {formatMoney(total, baseCurrency, true)}
        </div>
      </TourTarget>

      <div className="px-4">
        <TourTarget id="wallet-transfer" className="mb-4">
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              onTransfer();
            }}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-[15px] font-medium"
          >
            <ArrowLeftRight size={17} />
            Перевод между счетами
          </button>
        </TourTarget>

        {isError ? (
          <ErrorState message="Счета не загрузились" onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            iconBare
            icon={<img src={ACCOUNT_ICON_IMAGES['💳']} alt="" className="h-20 w-20 object-contain" />}
            title="Нет счетов"
            hint="Создайте счёт — карту, наличные или счёт в банке."
            action={
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="pressable mt-1 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-black"
              >
                Добавить счёт
              </button>
            }
          />
        ) : (
          /*
           * Счета в разных валютах складывать нельзя, поэтому группируем их
           * и показываем подытог по каждой валюте. Если валюта одна,
           * заголовок группы не рисуем — он был бы лишним.
           */
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.currency}>
                {groups.length > 1 && (
                  <div className="mb-1 flex items-baseline justify-between px-1">
                    <span className="text-[13px] font-medium uppercase tracking-wide text-muted">
                      {currencySymbol(group.currency)} {group.currency}
                    </span>
                    <span className="tabular text-[13px] text-muted">
                      {formatMoney(group.amount, group.currency)}
                      {group.currency !== baseCurrency && (
                        <span className="ml-1 opacity-70">
                          ≈ {formatMoney(group.inBase, baseCurrency)}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="divide-y divide-line/50 rounded-3xl bg-card px-4">
                  {group.accounts.map((account) => (
                    <ListRow
                      key={account.id}
                      icon={
                        <AccountIcon
                          icon={account.icon}
                          color={account.color}
                          className="h-10 w-10"
                          emojiClassName="text-[18px]"
                        />
                      }
                      iconBare
                      title={account.name}
                      /* В личном бюджете участник один, поэтому «общий/личный»
                         и имя владельца — лишний шум — валюта уже в заголовке группы. */
                      subtitle={
                        isFamily
                          ? account.isShared
                            ? `Общий · ${account.ownerName}`
                            : 'Личный счёт'
                          : undefined
                      }
                      right={
                        <span className="tabular text-[15px] font-semibold">
                          {formatMoney(account.balance, account.currency)}
                        </span>
                      }
                      onClick={() => setEditing(account)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AccountEditor
        open={creating || editing !== null}
        account={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function AccountEditor({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: AccountDto | null;
  onClose: () => void;
}) {
  const isFamily = useIsFamilyBudget();
  const save = useSaveAccount();
  const remove = useDeleteAccount();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [currency, setCurrency] = useState('RUB');
  const [initialBalance, setInitialBalance] = useState('0');
  const [isShared, setIsShared] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (account) {
      setName(account.name);
      setIcon(account.icon);
      setColor(account.color);
      setCurrency(account.currency);
      setIsShared(account.isShared);
      setInitialBalance('');
    } else {
      setName('');
      setIcon(ICONS[0]);
      setColor(COLORS[0]);
      setCurrency('RUB');
      setInitialBalance('0');
      setIsShared(true);
    }
  }, [open, account]);

  const submit = async () => {
    if (!name.trim()) {
      setError('Введите название счёта');
      return;
    }
    try {
      await save.mutateAsync({
        id: account?.id,
        name: name.trim(),
        icon,
        color,
        currency,
        isShared: isFamily ? isShared : true,
        ...(account
          ? initialBalance !== ''
            ? { initialBalance: Number(initialBalance.replace(',', '.')) || 0 }
            : {}
          : { initialBalance: Number(initialBalance.replace(',', '.')) || 0 }),
      });
      tg.haptic.success();
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось сохранить счёт');
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    try {
      await remove.mutateAsync(account.id);
      tg.haptic.success();
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось удалить счёт');
    }
  };

  useMainButton(open, account ? 'Сохранить' : 'Создать счёт', submit, save.isPending);

  return (
    <Sheet open={open} onClose={onClose} title={account ? 'Счёт' : 'Новый счёт'} tall>
      <div className="space-y-5 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название, например «Тинькофф»"
          className="w-full rounded-2xl bg-elevated px-4 py-3.5 text-[16px] outline-none placeholder:text-muted"
        />

        <div>
          <div className="mb-2 text-[13px] text-muted">Иконка</div>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setIcon(value);
                }}
                className={`pressable flex h-11 w-11 items-center justify-center rounded-full text-[19px] ${
                  icon === value ? 'bg-content' : 'bg-elevated'
                }`}
              >
                {/* Кружок кнопки уже даёт фон, поэтому картинку кладём без подложки. */}
                {ACCOUNT_ICON_IMAGES[value] ? (
                  <img
                    src={ACCOUNT_ICON_IMAGES[value]}
                    alt=""
                    className="h-7 w-7 object-contain"
                  />
                ) : (
                  value
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] text-muted">Цвет</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setColor(value);
                }}
                className="pressable h-9 w-9 rounded-full"
                style={{
                  backgroundColor: value,
                  boxShadow: color === value ? `0 0 0 3px rgb(var(--c-content))` : undefined,
                }}
                aria-label={value}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] text-muted">Валюта</div>
          <div className="scroll-x flex gap-2">
            {CURRENCIES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setCurrency(item.code);
                }}
                className={`pressable shrink-0 rounded-full px-3.5 py-2 text-[14px] font-medium ${
                  currency === item.code ? 'bg-content text-ink' : 'bg-elevated'
                }`}
              >
                {item.flag} {item.code}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-[13px] text-muted">
            {account ? 'Стартовый остаток (оставьте пустым, чтобы не менять)' : 'Текущий остаток'}
          </span>
          <input
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0"
            className="tabular w-full rounded-2xl bg-elevated px-4 py-3.5 text-[16px] outline-none"
          />
        </label>

        {isFamily && (
          <label className="flex items-center justify-between rounded-2xl bg-elevated px-4 py-3.5">
            <span>
              <span className="block text-[15px] font-medium">Общий счёт семьи</span>
              <span className="block text-[13px] text-muted">
                Личный счёт внутри семьи видите только вы
              </span>
            </span>
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => {
                tg.haptic.select();
                setIsShared(e.target.checked);
              }}
              className="h-6 w-6 accent-[color:rgb(var(--c-accent))]"
            />
          </label>
        )}

        {error && <div className="text-[14px] text-negative">{error}</div>}

        <PrimaryButton onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Сохраняем…' : account ? 'Сохранить' : 'Создать счёт'}
        </PrimaryButton>

        {account && (
          <button
            type="button"
            onClick={handleDelete}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-negative/15 px-4 py-3.5 text-[15px] font-semibold text-negative"
          >
            <Trash2 size={17} />
            Удалить счёт
          </button>
        )}
      </div>
    </Sheet>
  );
}
