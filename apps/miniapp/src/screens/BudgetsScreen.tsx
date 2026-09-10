import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Crown, LogOut, Plus, RefreshCw, Share2, Trash2, UserMinus, Users, Wallet,
} from 'lucide-react';
import type { BudgetDto } from '@budget/shared';
import { Sheet } from '../components/Sheet';
import { Skeleton } from '../components/ui';
import { useBudgetMutations, useSession } from '../lib/queries';
import { useAppStore } from '../store/app';
import { tg } from '../lib/telegram';

/** Экран бюджетов: создание, приглашения, участники и удаление. */
export function BudgetsScreen() {
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession();
  const [creating, setCreating] = useState<'personal' | 'family' | null>(null);
  const [joining, setJoining] = useState(false);
  const [details, setDetails] = useState<BudgetDto | null>(null);

  const budgets = session?.budgets ?? [];
  const personal = budgets.filter((b) => b.kind === 'personal');
  const family = budgets.filter((b) => b.kind === 'family');

  return (
    <div className="pb-24">
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(10px+var(--safe-top))]">
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            navigate(-1);
          }}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[20px] font-bold">Бюджеты</h1>
      </header>

      {isLoading ? (
        <div className="space-y-2 px-4">
          <Skeleton className="h-16 w-full rounded-3xl" />
          <Skeleton className="h-16 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-5 px-4">
          <Section title="Личные" items={personal} onOpen={setDetails} />
          <Section title="Семейные" items={family} onOpen={setDetails} />

          <div className="space-y-2">
            <ActionRow
              icon={<Wallet size={18} />}
              label="Создать личный бюджет"
              hint="Отдельный кошелёк — например, для бизнеса или отпуска"
              onClick={() => setCreating('personal')}
            />
            <ActionRow
              icon={<Users size={18} />}
              label="Создать семейный бюджет"
              hint="Общие счета и операции с близкими"
              onClick={() => setCreating('family')}
            />
            <ActionRow
              icon={<Share2 size={18} />}
              label="Присоединиться по коду"
              hint="Если вас пригласили в семейный бюджет"
              onClick={() => setJoining(true)}
            />
          </div>
        </div>
      )}

      <CreateSheet kind={creating} onClose={() => setCreating(null)} />
      <JoinSheet open={joining} onClose={() => setJoining(false)} />
      <DetailsSheet budget={details} onClose={() => setDetails(null)} />
    </div>
  );
}

function Section({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: BudgetDto[];
  onOpen: (b: BudgetDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-card">
        <div className="divide-y divide-line/50">
          {items.map((budget) => (
            <button
              key={budget.id}
              type="button"
              onClick={() => {
                tg.haptic.light();
                onOpen(budget);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-[18px]">
                {budget.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium">{budget.name}</span>
                  {budget.isOwner && <Crown size={12} className="shrink-0 text-accent" />}
                </span>
                <span className="block truncate text-[13px] text-muted">
                  {budget.kind === 'family'
                    ? `${budget.members.length} ${pluralMembers(budget.members.length)} · ${budget.accountCount} ${pluralAccounts(budget.accountCount)}`
                    : `${budget.accountCount} ${pluralAccounts(budget.accountCount)} · ${budget.transactionCount} операций`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tg.haptic.light();
        onClick();
      }}
      className="pressable flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block truncate text-[13px] text-muted">{hint}</span>
      </span>
      <Plus size={18} className="shrink-0 text-muted" />
    </button>
  );
}

function CreateSheet({ kind, onClose }: { kind: 'personal' | 'family' | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const { create } = useBudgetMutations();
  const setBudgetId = useAppStore((s) => s.setBudgetId);

  const submit = () => {
    if (!kind || !name.trim()) return;
    create.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: (budget) => {
          tg.haptic.success();
          setBudgetId(budget.id);
          setName('');
          onClose();
        },
        onError: () => tg.haptic.error(),
      },
    );
  };

  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={kind === 'family' ? 'Новый семейный бюджет' : 'Новый личный бюджет'}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === 'family' ? 'Семья Ивановых' : 'Отпуск'}
        autoFocus
        className="w-full rounded-2xl bg-elevated px-4 py-3 text-[16px] outline-none placeholder:text-muted"
      />
      <p className="mt-3 text-[13px] leading-snug text-muted">
        {kind === 'family'
          ? 'В семейном бюджете видны операции всех участников. После создания появится ссылка-приглашение.'
          : 'Личный бюджет виден только вам. У него свои счета, категории и статистика.'}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || create.isPending}
        className="pressable mt-4 w-full rounded-2xl bg-content px-4 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-40"
      >
        {create.isPending ? 'Создаю…' : 'Создать'}
      </button>
    </Sheet>
  );
}

function JoinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { join } = useBudgetMutations();
  const setBudgetId = useAppStore((s) => s.setBudgetId);

  const submit = () => {
    setError('');
    join.mutate(code.trim().toUpperCase(), {
      onSuccess: (budget) => {
        tg.haptic.success();
        setBudgetId(budget.id);
        setCode('');
        onClose();
      },
      onError: (err) => {
        tg.haptic.error();
        setError((err as Error).message);
      },
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Присоединиться">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCD1234"
        autoFocus
        maxLength={8}
        className="tabular w-full rounded-2xl bg-elevated px-4 py-3 text-center text-[20px] font-semibold tracking-widest outline-none placeholder:text-muted"
      />
      {error && <p className="mt-2 text-center text-[13px] text-negative">{error}</p>}
      <p className="mt-3 text-[13px] leading-snug text-muted">
        Введите код из приглашения. Если бюджет удалили, код перестаёт работать.
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={code.trim().length < 4 || join.isPending}
        className="pressable mt-4 w-full rounded-2xl bg-content px-4 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-40"
      >
        {join.isPending ? 'Проверяю…' : 'Присоединиться'}
      </button>
    </Sheet>
  );
}

function DetailsSheet({ budget, onClose }: { budget: BudgetDto | null; onClose: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Участник, которого собираются исключить: подтверждаем перед удалением. */
  const [confirmMember, setConfirmMember] = useState<{ userId: number; name: string } | null>(null);
  const { remove, leave, removeMember, rotateInvite, share } = useBudgetMutations();
  const { data: session } = useSession();

  if (!budget) return null;

  const isLast = (session?.budgets.length ?? 0) <= 1;

  const doDelete = () => {
    remove.mutate(budget.id, {
      onSuccess: () => {
        tg.haptic.success();
        setConfirmDelete(false);
        onClose();
      },
      onError: () => tg.haptic.error(),
    });
  };

  return (
    <Sheet open onClose={onClose} title={budget.name} tall>
      <div className="space-y-4 pt-1">
        {/* Приглашение — только у семейных бюджетов */}
        {budget.kind === 'family' && budget.inviteLink && (
          <div className="rounded-2xl bg-elevated/50 p-4">
            <div className="text-[13px] text-muted">Код приглашения</div>
            <div className="tabular mt-1 text-[22px] font-bold tracking-widest">
              {budget.inviteCode}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  tg.haptic.light();
                  tg.shareLink(budget.inviteLink!, `Присоединяйтесь к бюджету «${budget.name}»`);
                }}
                className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl bg-content px-3 py-2.5 text-[14px] font-semibold text-ink"
              >
                <Share2 size={15} />
                Поделиться
              </button>
              {budget.isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    tg.haptic.light();
                    rotateInvite.mutate(budget.id);
                  }}
                  className="pressable flex items-center justify-center gap-2 rounded-xl bg-elevated px-3 py-2.5 text-[14px]"
                >
                  <RefreshCw size={15} />
                </button>
              )}
            </div>
            <p className="mt-2 text-[12px] leading-snug text-muted">
              Обновление кода отключает старую ссылку.
            </p>
          </div>
        )}

        {/* Личный бюджет можно открыть для близких */}
        {budget.kind === 'personal' && budget.isOwner && (
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              share.mutate(budget.id);
            }}
            className="pressable flex w-full items-center gap-3 rounded-2xl bg-elevated/50 px-4 py-3 text-left"
          >
            <Users size={18} className="text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Открыть для близких</span>
              <span className="block text-[13px] text-muted">
                Появится ссылка-приглашение, бюджет станет семейным
              </span>
            </span>
          </button>
        )}

        {/* Участники */}
        {budget.kind === 'family' && (
          <div>
            <div className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
              Участники
            </div>
            <div className="divide-y divide-line/50 rounded-2xl bg-elevated/50 px-4">
              {budget.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-[14px] font-semibold">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.name[0]?.toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px]">{member.name}</span>
                      {member.isOwner && <Crown size={12} className="shrink-0 text-accent" />}
                    </span>
                    {member.username && (
                      <span className="block truncate text-[12px] text-muted">
                        @{member.username}
                      </span>
                    )}
                  </span>
                  {budget.isOwner && !member.isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        tg.haptic.warning();
                        setConfirmMember({ userId: member.userId, name: member.name });
                      }}
                      className="pressable flex h-9 w-9 items-center justify-center rounded-full text-negative"
                      aria-label={`Исключить ${member.name}`}
                    >
                      <UserMinus size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {confirmMember && (
              <div className="mt-2 rounded-2xl bg-negative/10 p-4">
                <div className="text-[15px] font-semibold text-negative">
                  Исключить {confirmMember.name}?
                </div>
                <p className="mt-1 text-[13px] leading-snug text-muted">
                  Участник потеряет доступ к бюджету и его счетам. Операции, которые он
                  добавил, останутся в истории — иначе балансы разойдутся. Вернуться он
                  сможет только по новому приглашению.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmMember(null)}
                    className="pressable flex-1 rounded-xl bg-elevated px-4 py-2.5 text-[14px] font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      tg.haptic.warning();
                      removeMember.mutate(
                        { budgetId: budget.id, userId: confirmMember.userId },
                        { onSettled: () => setConfirmMember(null) },
                      );
                    }}
                    disabled={removeMember.isPending}
                    className="pressable flex-1 rounded-xl bg-negative px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
                  >
                    {removeMember.isPending ? 'Исключаю…' : 'Исключить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Опасная зона */}
        <div className="space-y-2 pt-1">
          {!budget.isOwner && budget.kind === 'family' && (
            <button
              type="button"
              onClick={() => {
                tg.haptic.warning();
                leave.mutate(budget.id, { onSuccess: onClose });
              }}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-elevated px-4 py-3 text-[15px] font-medium"
            >
              <LogOut size={17} />
              Выйти из бюджета
            </button>
          )}

          {budget.isOwner && !confirmDelete && (
            <button
              type="button"
              onClick={() => {
                tg.haptic.warning();
                setConfirmDelete(true);
              }}
              disabled={isLast}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-negative/10 px-4 py-3 text-[15px] font-medium text-negative disabled:opacity-40"
            >
              <Trash2 size={17} />
              Удалить бюджет
            </button>
          )}

          {isLast && budget.isOwner && (
            <p className="text-center text-[12px] text-muted">
              Нельзя удалить единственный бюджет
            </p>
          )}

          {confirmDelete && (
            <div className="rounded-2xl bg-negative/10 p-4">
              <div className="text-[15px] font-semibold text-negative">Удалить «{budget.name}»?</div>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                Исчезнут {budget.accountCount} {pluralAccounts(budget.accountCount)} и{' '}
                {budget.transactionCount} операций.
                {budget.kind === 'family' && ' Участники потеряют доступ, ссылка-приглашение перестанет работать.'}
                {' '}Восстановить не получится.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="pressable flex-1 rounded-xl bg-elevated px-4 py-2.5 text-[14px] font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={remove.isPending}
                  className="pressable flex-1 rounded-xl bg-negative px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  {remove.isPending ? 'Удаляю…' : 'Удалить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function pluralMembers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'участник';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника';
  return 'участников';
}

function pluralAccounts(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'счёт';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'счёта';
  return 'счетов';
}
