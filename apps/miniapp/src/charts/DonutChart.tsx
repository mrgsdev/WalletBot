import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pastel } from '../lib/palette';

export interface DonutSegment {
  id: string | number;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Зазор между сегментами в пикселях длины дуги. */
  gap?: number;
  children?: ReactNode;
  onSegmentClick?: (id: string | number) => void;
  activeId?: string | number | null;
}

/**
 * Кольцевая диаграмма из скруглённых сегментов-«таблеток» с зазорами.
 *
 * Рисуем вручную на SVG: библиотечные donut-чарты дают сплошное кольцо,
 * а нам нужны именно отдельные капсулы. Цвета приглушаются до пастельных —
 * шесть насыщенных дуг рядом дерутся друг с другом и с цифрой в центре.
 */
export function DonutChart({
  segments,
  size = 240,
  thickness = 26,
  gap = 14,
  children,
  onSegmentClick,
  activeId = null,
}: Props) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);

  const visible = segments.filter((s) => s.value > 0);
  const count = visible.length;

  /*
   * Считаем ВИДИМУЮ длину капсулы, а не длину штриха.
   *
   * strokeLinecap="round" дорисовывает по половине толщины с каждого конца,
   * поэтому капсула на экране длиннее штриха ровно на `thickness`. Если считать
   * по штриху, соседи налезают друг на друга, когда зазор меньше толщины,
   * а короткие сегменты раздуваются до размера средних.
   */
  const minVisual = Math.min(thickness, circumference / Math.max(count, 1));
  // Зазоры не должны сжать капсулы ниже минимума, даже если категорий много.
  const maxGap = count > 0 ? Math.max(0, (circumference - count * minVisual) / count) : 0;
  const effectiveGap = count > 1 ? Math.min(gap, maxGap) : 0;
  const available = circumference - effectiveGap * count;

  // Доли по значению, но не короче минимума.
  const visuals = visible.map((segment) =>
    Math.max((total > 0 ? segment.value / total : 0) * available, minVisual),
  );

  // Подтянув мелкие до минимума, мы вышли за окружность — забираем излишек
  // у тех, кому есть что отдать, пропорционально их запасу.
  const excess = visuals.reduce((sum, v) => sum + v, 0) - available;
  if (excess > 0) {
    const slack = visuals.map((v) => Math.max(0, v - minVisual));
    const slackTotal = slack.reduce((sum, v) => sum + v, 0);
    if (slackTotal > 0) {
      const ratio = Math.min(1, excess / slackTotal);
      for (let i = 0; i < visuals.length; i++) visuals[i] -= slack[i] * ratio;
    }
  }

  let position = 0;
  const arcs = visible.map((segment, index) => {
    const visual = visuals[index];
    const arc = {
      ...segment,
      visual,
      // Штрих короче капсулы на толщину — остаток дорисуют круглые концы.
      dash: Math.max(visual - thickness, 0.01),
      // Штрих начинается на полтолщины позже, чтобы левая шапочка легла в позицию.
      offset: position + thickness / 2,
      fill: pastel(segment.color, index),
    };
    position += visual + effectiveGap;
    return arc;
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {total === 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(var(--c-elevated))"
            strokeWidth={thickness}
            opacity={0.5}
          />
        )}
        {arcs.map((arc, index) => {
          const dimmed = activeId !== null && activeId !== arc.id;
          return (
            <motion.circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.fill}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              initial={{ strokeDashoffset: -circumference, opacity: 0 }}
              animate={{
                strokeDashoffset: -arc.offset,
                opacity: dimmed ? 0.3 : 1,
              }}
              transition={{
                strokeDashoffset: { type: 'spring', stiffness: 120, damping: 20, delay: index * 0.04 },
                opacity: { duration: 0.2 },
              }}
              style={{ cursor: onSegmentClick ? 'pointer' : undefined }}
              onClick={() => onSegmentClick?.(arc.id)}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
