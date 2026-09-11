import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Moon,
  Palette, Sun, SunMoon,
} from 'lucide-react';
import { CURRENCIES, type ThemeMode } from '@budget/shared';
import accountsIcon from '../assets/accounts.png';
import exportIcon from '../assets/export.png';
import tourIcon from '../assets/tour.png';
import categoriesIcon from '../assets/categories.png';
import planIcon from '../assets/plan.png';
import themeIcon3d from '../assets/theme.png';
import bellIcon from '../assets/bell.png';
import currencyIcon from '../assets/currency.png';
import membersIcon from '../assets/members.png';
import { Sheet } from '../components/Sheet';
import { Segmented } from '../components/Segmented';
import { TOUR, TourTarget, useTour } from '../components/Tour';
import { Skeleton } from '../components/ui';
import { BudgetSwitcher } from '../components/BudgetSwitcher';
import { useSendExport, useSession, useUpdateSettings } from '../lib/queries';
import { useAppStore } from '../store/app';
import { MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';
import { APP_NAME } from '../lib/appName';

/** Настройки: тема, валюта отчётов, напоминания, экспорт и справочники. */
export function MoreScreen() {
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession();
  const [sheet, setSheet] = useState<'theme' | 'currency' | 'export' | null>(null);

  const settings = session?.settings;

  return (
    <div className="pb-28">
      <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-[calc(10px+var(--safe-top))]">
        <h1 className="text-[22px] font-bold">Ещё</h1>
        <BudgetSwitcher />
      </header>

      {isLoading || !settings ? (
        <div className="space-y-2 px-4">
          <Skeleton className="h-16 w-full rounded-3xl" />
          <Skeleton className="h-16 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-5 px-4">
          {/* Профиль */}
          <div className="flex items-center gap-3 rounded-3xl bg-card p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[18px] font-semibold">
              {session.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                session.user.name[0]?.toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold">{session.user.name}</div>
              {session.user.username && (
                <div className="truncate text-[13px] text-muted">@{session.user.username}</div>
              )}
            </div>
          </div>

          <Group title="Бюджет">
            <TourTarget id="more-budgets">
              <Row iconBare icon={<MenuIcon src={membersIcon} />} label="Бюджеты и участники"
                   hint={`${session.budgets.length} ${pluralBudgets(session.budgets.length)}`}
                   onClick={() => navigate('/budgets')} />
            </TourTarget>
            <Row iconBare icon={<MenuIcon src={accountsIcon} />} label="Счета" onClick={() => navigate('/wallet')} />
            <Row iconBare icon={<MenuIcon src={categoriesIcon} />} label="Категории" onClick={() => navigate('/categories')} />
            <Row iconBare icon={<MenuIcon src={planIcon} />} label="План на месяц" onClick={() => navigate('/plans')} />
          </Group>

          <Group title="Настройки">
            <TourTarget id="more-theme">
              <Row
                iconBare
                icon={<MenuIcon src={themeIcon3d} />}
                label="Тема"
                hint={THEME_LABELS[settings.theme]}
                onClick={() => setSheet('theme')}
              />
            </TourTarget>
            <Row
              iconBare
              icon={<MenuIcon src={currencyIcon} />}
              label="Валюта отчётов"
              hint={settings.baseCurrency}
              onClick={() => setSheet('currency')}
            />
            <TourTarget id="more-reminder">
              <Row
                iconBare
                icon={<MenuIcon src={bellIcon} />}
                label="Напоминания"
                hint={
                  settings.dailyReminder
                    ? `Ежедневно в ${settings.dailyReminderTime} и регулярные платежи`
                    : 'Ежедневное и регулярные платежи'
                }
                onClick={() => navigate('/reminders')}
              />
            </TourTarget>
          </Group>

          <Group title="Данные">
            <TourTarget id="more-export">
              <Row
                iconBare
                icon={<MenuIcon src={exportIcon} />}
                label="Выгрузить в Excel"
                hint="Файл придёт сообщением от бота"
                onClick={() => setSheet('export')}
              />
            </TourTarget>
            <TourTarget id="more-replay">
              <ReplayTourRow />
            </TourTarget>
          </Group>

          <p className="px-1 pb-2 text-center text-[12px] text-muted">
            {APP_NAME} · учёт финансов в Telegram
          </p>
        </div>
      )}

      <ThemeSheet open={sheet === 'theme'} onClose={() => setSheet(null)} current={settings?.theme ?? 'system'} />
      <CurrencySheet open={sheet === 'currency'} onClose={() => setSheet(null)} current={settings?.baseCurrency ?? 'RUB'} />
      <ExportSheet open={sheet === 'export'} onClose={() => setSheet(null)} />
    </div>
  );
}

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
};

function themeIcon(mode: ThemeMode) {
  if (mode === 'light') return <Sun size={18} />;
  if (mode === 'dark') return <Moon size={18} />;
  return <SunMoon size={18} />;
}

function ThemeSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: ThemeMode }) {
  const update = useUpdateSettings();
  const setTheme = useAppStore((s) => s.setTheme);

  const choose = (theme: ThemeMode) => {
    tg.haptic.select();
    // Применяем сразу, не дожидаясь ответа сервера.
    setTheme(theme);
    update.mutate({ theme });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Тема">
      <div className="space-y-2 pt-1">
        {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => choose(mode)}
            className={`pressable flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${
              current === mode ? 'bg-content text-ink' : 'bg-elevated'
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center">{themeIcon(mode)}</span>
            <span className="flex-1 text-[15px] font-medium">{THEME_LABELS[mode]}</span>
            {current === mode && <span>✓</span>}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted">
        «Как в системе» подстраивается под тему Telegram, а в браузере — под настройку устройства.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-elevated/50 p-3">
        <Palette size={16} className="shrink-0 text-muted" />
        <span className="text-[13px] text-muted">Изменения применяются сразу</span>
      </div>
    </Sheet>
  );
}

function CurrencySheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const update = useUpdateSettings();

  return (
    <Sheet open={open} onClose={onClose} title="Валюта отчётов" tall>
      <p className="pb-3 text-[13px] leading-snug text-muted">
        В этой валюте считаются общий баланс, статистика и бюджет на месяц.
        Счета остаются в своих валютах.
      </p>
      <div className="divide-y divide-line/60">
        {CURRENCIES.map((currency) => (
          <button
            key={currency.code}
            type="button"
            onClick={() => {
              tg.haptic.select();
              update.mutate({ baseCurrency: currency.code }, { onSuccess: onClose });
            }}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <span className="text-[22px]">{currency.flag}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {currency.code} {currency.symbol}
              </span>
              <span className="block truncate text-[13px] text-muted">{currency.name}</span>
            </span>
            {currency.code === current && <span className="text-accent">✓</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  const send = useSendExport();

  const submit = () => {
    setError('');
    setDone(null);
    send.mutate(
      {
        year,
        fromMonth: mode === 'year' ? 1 : month,
        toMonth: mode === 'year' ? 12 : month,
      },
      {
        onSuccess: (result) => {
          tg.haptic.success();
          setDone(`Отправил ${result.transactionCount} операций`);
        },
        onError: (err) => {
          tg.haptic.error();
          setError((err as Error).message);
        },
      },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Выгрузка в Excel">
      <div className="space-y-3 pt-1">
        <div className="flex justify-center">
          <Segmented
            options={[
              { value: 'month', label: 'Месяц' },
              { value: 'year', label: 'Год' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === 'month' && (
          <div className="scroll-x flex gap-1.5 pb-1">
            {MONTHS_NOM.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setMonth(index + 1);
                }}
                className={`pressable shrink-0 rounded-full px-3.5 py-2 text-[14px] ${
                  month === index + 1 ? 'bg-content text-ink' : 'bg-elevated text-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {[year - 1, year, year + 1].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`pressable rounded-full px-4 py-2 text-[14px] ${
                y === year ? 'bg-content text-ink' : 'bg-elevated text-muted'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-elevated/50 p-3.5 text-[13px] leading-snug text-muted">
          Файл придёт сообщением от бота — в приложении Telegram скачивание работает
          ненадёжно. Внутри два листа: план и факт по категориям, и полный список операций.
        </div>

        {done && (
          <div className="rounded-2xl bg-positive/15 p-3.5 text-center text-[14px] text-positive">
            {done} — проверьте чат с ботом
          </div>
        )}
        {error && (
          <div className="rounded-2xl bg-negative/15 p-3.5 text-center text-[14px] text-negative">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={send.isPending}
          className="pressable w-full rounded-2xl bg-content px-4 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-50"
        >
          {send.isPending ? 'Готовлю файл…' : 'Отправить в чат'}
        </button>
      </div>
    </Sheet>
  );
}

/** Запускает пошаговое обучение заново с первого шага. */
function ReplayTourRow() {
  const tour = useTour();
  return (
    <Row
      iconBare
      icon={<MenuIcon src={tourIcon} />}
      label="Пройти обучение заново"
      hint={`${TOUR.length} шагов по всему приложению`}
      onClick={() => tour?.start()}
    />
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-card">
        <div className="divide-y divide-line/50">{children}</div>
      </div>
    </section>
  );
}

function Row({
  icon, label, hint, onClick, renderRight, iconBare = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  renderRight?: React.ReactNode;
  /** Иконка сама себе картинка — рисуем без кружка-подложки. */
  iconBare?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!onClick) return;
        tg.haptic.light();
        onClick();
      }}
      className="flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      {iconBare ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{label}</span>
        {hint && <span className="block truncate text-[13px] text-muted">{hint}</span>}
      </span>
      {renderRight ?? <ChevronRight size={18} className="shrink-0 text-muted" />}
    </button>
  );
}

function pluralBudgets(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'бюджет';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'бюджета';
  return 'бюджетов';
}

/** Объёмная иконка строки меню — в габарите прежнего кружка. */
function MenuIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="h-9 w-9 object-contain" />;
}
