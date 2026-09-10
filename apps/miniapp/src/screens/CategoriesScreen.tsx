import { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronLeft, Plus, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CategoryDto } from '@budget/shared';
import { CHART_PALETTE } from '@budget/shared';
import { Segmented } from '../components/Segmented';
import { Sheet } from '../components/Sheet';
import { EmptyState, PrimaryButton, Skeleton } from '../components/ui';
import { useCategories, useSaveCategory } from '../lib/queries';
import { apiFetch } from '../lib/api';
import { tg } from '../lib/telegram';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/app';

const ICON_CHOICES = [
  '🛒', '🍽', '🥡', '🏠', '💡', '📶', '🔁', '🛡', '🏦', '🧴', '🛠', '💊',
  '🐾', '⛽️', '🚗', '🚕', '🚨', '👕', '💅', '🩺', '📚', '🧸', '🎒', '🎨',
  '✈️', '🎉', '📣', '🧰', '🧾', '❗️', '🏗', '📦', '💼', '🧑‍💻', '💸', '🎁',
];

/** Управление категориями: создание, изменение иконки/цвета, архивация. */
export function CategoriesScreen() {
  const navigate = useNavigate();
  const budgetId = useAppStore((s) => s.budgetId);
  const queryClient = useQueryClient();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [creating, setCreating] = useState(false);

  const active = useCategories(type);

  const archived = useQuery({
    queryKey: ['categories', budgetId, 'archived', type],
    queryFn: () =>
      apiFetch<CategoryDto[]>('/categories', { query: { type, includeArchived: 'true' } }),
    enabled: showArchived,
  });

  const list = useMemo(() => {
    if (!showArchived) return active.data ?? [];
    return (archived.data ?? []).filter((c) => c.isArchived);
  }, [showArchived, active.data, archived.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, CategoryDto[]>();
    for (const category of list) {
      const key = category.group ?? 'Прочее';
      map.set(key, [...(map.get(key) ?? []), category]);
    }
    return [...map.entries()];
  }, [list]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink/90 px-4 pb-3 pt-[calc(10px+var(--safe-top))] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
          aria-label="Назад"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold">Категории</h1>
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            setCreating(true);
          }}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
          aria-label="Новая категория"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <Segmented
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Доходы' },
          ]}
        />
        <button
          type="button"
          onClick={() => {
            tg.haptic.select();
            setShowArchived((v) => !v);
          }}
          className={`pressable flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium ${
            showArchived ? 'bg-content text-ink' : 'bg-elevated'
          }`}
        >
          <Archive size={14} />
          Архив
        </button>
      </div>

      {active.isLoading ? (
        <div className="space-y-3 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="🏷"
          title={showArchived ? 'Архив пуст' : 'Категорий нет'}
          hint={showArchived ? 'Архивированные категории появятся здесь.' : 'Создайте первую категорию.'}
        />
      ) : (
        <div className="space-y-5 px-4">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
                {group}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {items.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      tg.haptic.light();
                      setEditing(category);
                    }}
                    className="pressable flex flex-col items-center gap-1.5 rounded-2xl p-2"
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full text-[24px]"
                      style={{ backgroundColor: `${category.color}26` }}
                    >
                      {category.icon}
                    </span>
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted">
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryEditor
        open={creating || editing !== null}
        category={editing}
        defaultType={type}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          refresh();
          if (showArchived) archived.refetch();
        }}
      />
    </div>
  );
}

function CategoryEditor({
  open,
  category,
  defaultType,
  onClose,
}: {
  open: boolean;
  category: CategoryDto | null;
  defaultType: 'expense' | 'income';
  onClose: () => void;
}) {
  const save = useSaveCategory();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(CHART_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    } else {
      setName('');
      setIcon(ICON_CHOICES[0]);
      setColor(CHART_PALETTE[0]);
    }
  }, [open, category]);

  const submit = async () => {
    if (!name.trim()) {
      setError('Введите название');
      return;
    }
    try {
      await save.mutateAsync({
        id: category?.id,
        name: name.trim(),
        icon,
        color,
        ...(category ? {} : { type: defaultType, group: 'Прочее' }),
      });
      tg.haptic.success();
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  };

  const toggleArchive = async () => {
    if (!category) return;
    try {
      await save.mutateAsync({ id: category.id, isArchived: !category.isArchived });
      tg.haptic.success();
      onClose();
    } catch (err) {
      tg.haptic.error();
      setError(err instanceof Error ? err.message : 'Не удалось изменить категорию');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={category ? 'Категория' : 'Новая категория'} tall>
      <div className="space-y-5 pt-1">
        <div className="flex justify-center">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-[34px]"
            style={{ backgroundColor: `${color}33` }}
          >
            {icon}
          </span>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название категории"
          className="w-full rounded-2xl bg-elevated px-4 py-3.5 text-[16px] outline-none placeholder:text-muted"
        />

        <div>
          <div className="mb-2 text-[13px] text-muted">Иконка</div>
          <div className="grid grid-cols-6 gap-2">
            {ICON_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setIcon(value);
                }}
                className={`pressable flex h-11 items-center justify-center rounded-xl text-[19px] ${
                  icon === value ? 'bg-content' : 'bg-elevated'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] text-muted">Цвет</div>
          <div className="flex flex-wrap gap-2">
            {CHART_PALETTE.map((value) => (
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
                  boxShadow: color === value ? '0 0 0 3px rgb(var(--c-content))' : undefined,
                }}
                aria-label={value}
              />
            ))}
          </div>
        </div>

        {error && <div className="text-[14px] text-negative">{error}</div>}

        <PrimaryButton onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Сохраняем…' : 'Сохранить'}
        </PrimaryButton>

        {category && (
          <button
            type="button"
            onClick={toggleArchive}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-elevated px-4 py-3.5 text-[15px] font-medium"
          >
            {category.isArchived ? <RotateCcw size={17} /> : <Archive size={17} />}
            {category.isArchived ? 'Вернуть из архива' : 'В архив'}
          </button>
        )}
      </div>
    </Sheet>
  );
}
