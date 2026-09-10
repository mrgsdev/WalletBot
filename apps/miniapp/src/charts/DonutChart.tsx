import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

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
 * Кольцевая диаграмма из скруглённых сегментов-«таблеток» с зазорами —
 * как на референсном экране статистики.
 *
 * Рисуем вручную на SVG: библиотечные donut-чарты дают сплошное кольцо,
 * а нам нужны именно отдельные капсулы.
 */
export function DonutChart({
  segments,
  size = 240,
  thickness = 26,
  gap = 10,
  children,
  onSegmentClick,
  activeId = null,
}: Props) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);

  const visible = segments.filter((s) => s.value > 0);
  // Зазор не должен съедать кольцо, если категорий очень много.
  const effectiveGap = visible.length > 1 ? Math.min(gap, circumference / (visible.length * 3)) : 0;
  const available = circumference - effectiveGap * visible.length;

  let offset = 0;
  const arcs = visible.map((segment) => {
    const share = total > 0 ? segment.value / total : 0;
    const length = Math.max(share * available, thickness * 0.15);
    const arc = { ...segment, length, offset };
    offset += length + effectiveGap;
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
              stroke={arc.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              initial={{ strokeDashoffset: -circumference, opacity: 0 }}
              animate={{
                strokeDashoffset: -arc.offset,
                opacity: dimmed ? 0.25 : 1,
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
