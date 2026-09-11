import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { tg } from '../lib/telegram';

/** Круглая кнопка-иконка — используется в шапках и на экране ввода. */
export function IconButton({
  children,
  className = '',
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`pressable flex h-11 w-11 items-center justify-center rounded-full bg-card text-content ${className}`}
      onClick={(e) => {
        tg.haptic.light();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Пилюля с иконкой и текстом (счёт, валюта, категория, дата). */
export function Chip({
  children,
  onClick,
  className = '',
  active = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!onClick) return;
        tg.haptic.light();
        onClick();
      }}
      className={`pressable inline-flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium ${
        active ? 'bg-content text-ink' : 'bg-elevated/80 text-content'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-card p-4 ${className}`}>{children}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Пустое состояние: иконка, заголовок, подсказка и опциональное действие. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  iconBare = false,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  /** Иконка сама себе картинка — рисуем без кружка-подложки. */
  iconBare?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center"
    >
      {iconBare ? (
        icon
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated/60 text-[28px]">
          {icon}
        </div>
      )}
      <div className="text-[17px] font-semibold">{title}</div>
      {hint && <div className="text-[14px] leading-snug text-muted">{hint}</div>}
      {action}
    </motion.div>
  );
}

/** Ошибка загрузки без падения интерфейса. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="⚠️"
      title="Не удалось загрузить"
      hint={message}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="pressable mt-2 rounded-full bg-elevated px-5 py-2.5 text-[14px] font-medium"
          >
            Повторить
          </button>
        ) : undefined
      }
    />
  );
}

export function PrimaryButton({
  children,
  className = '',
  onClick,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        tg.haptic.medium();
        onClick?.(e);
      }}
      className={`pressable w-full rounded-2xl bg-content px-5 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Строка списка с иконкой-кружком слева. */
export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onClick,
  iconBare = false,
}: {
  icon: ReactNode;
  iconColor?: string;
  /** Иконка сама себе картинка — рисуем без кружка-подложки. */
  iconBare?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={
        onClick
          ? () => {
              tg.haptic.light();
              onClick();
            }
          : undefined
      }
      className="flex w-full items-center gap-3 py-2.5 text-left"
    >
      {iconBare ? (
        <div className="shrink-0">{icon}</div>
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{ backgroundColor: iconColor ? `${iconColor}26` : 'rgb(var(--c-elevated))' }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </Wrapper>
  );
}
