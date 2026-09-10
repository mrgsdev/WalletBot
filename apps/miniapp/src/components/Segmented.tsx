import { motion } from 'framer-motion';
import { useId } from 'react';
import { tg } from '../lib/telegram';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

/** Сегментированный контрол в стиле iOS с «переезжающей» подложкой. */
export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: Props<T>) {
  const layoutId = useId();
  const pad = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-[14px]';

  return (
    <div className="inline-flex rounded-full bg-elevated/70 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!active) {
                tg.haptic.select();
                onChange(option.value);
              }
            }}
            className={`relative rounded-full font-medium transition-colors ${pad} ${
              active ? 'text-ink' : 'text-muted'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-content"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
