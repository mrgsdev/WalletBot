import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { tg } from '../lib/telegram';

const ITEM = 44;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM;
const SPRING = { type: 'spring' as const, stiffness: 400, damping: 40 };

const FADE = 'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)';

export interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

export function WheelGroup({ children }: { children: ReactNode }) {
  return (
    <div className="relative select-none" style={{ height: VISIBLE * ITEM }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-elevated"
        style={{ height: ITEM }}
      />
      <div className="relative flex h-full" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
        {children}
      </div>
    </div>
  );
}

export function Wheel<T extends string | number>({
  options,
  value,
  onChange,
  className = 'flex-1',
}: {
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const target = -index * ITEM;

  const y = useMotionValue(target);

  const aiming = useRef(target);
  const shown = useRef(index);

  const clamp = (i: number) => Math.min(Math.max(i, 0), options.length - 1);
  const indexAt = (offset: number) => clamp(Math.round(-offset / ITEM));

  useEffect(() => {
    if (aiming.current === target) return;
    aiming.current = target;
    const controls = animate(y, target, SPRING);
    return () => controls.stop();
  }, [target, y]);

  useMotionValueEvent(y, 'change', (offset) => {
    const next = indexAt(offset);
    if (next === shown.current) return;
    shown.current = next;
    tg.haptic.select();
  });

  const select = (next: number) => {
    const option = options[clamp(next)];
    if (!option) return;
    aiming.current = -clamp(next) * ITEM;
    animate(y, aiming.current, SPRING);
    if (option.value !== value) onChange(option.value);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.div
        style={{ y, paddingTop: PAD, paddingBottom: PAD }}
        drag="y"
        dragMomentum={false}
        dragElastic={0.12}
        dragConstraints={{ top: -(options.length - 1) * ITEM, bottom: 0 }}
        onDragEnd={(_, info) => select(indexAt(y.get() + info.velocity.y * 0.12))}
      >
        {options.map((option, i) => (
          <WheelItem
            key={option.value}
            y={y}
            index={i}
            label={option.label}
            onSelect={() => select(i)}
          />
        ))}
      </motion.div>
    </div>
  );
}

function WheelItem({
  y,
  index,
  label,
  onSelect,
}: {
  y: MotionValue<number>;
  index: number;
  label: string;
  onSelect: () => void;
}) {
  const distance = useTransform(y, (offset) => Math.abs(offset + index * ITEM) / ITEM);
  const opacity = useTransform(distance, [0, 1, 2], [1, 0.45, 0.18]);
  const scale = useTransform(distance, [0, 2], [1, 0.84]);

  const pressed = useRef<number | null>(null);

  return (
    <motion.button
      type="button"
      style={{ height: ITEM, opacity, scale }}
      className="flex w-full items-center justify-center whitespace-nowrap text-[17px] font-medium"
      onPointerDown={(event) => {
        pressed.current = event.clientY;
      }}
      onClick={(event) => {
        const from = pressed.current;
        pressed.current = null;
        if (from !== null && Math.abs(event.clientY - from) <= 6) onSelect();
      }}
    >
      {label}
    </motion.button>
  );
}
