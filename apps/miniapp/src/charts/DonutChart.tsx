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

  gap?: number;
  children?: ReactNode;
  onSegmentClick?: (id: string | number) => void;
  activeId?: string | number | null;
}

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

  const minVisual = Math.min(thickness, circumference / Math.max(count, 1));

  const maxGap = count > 0 ? Math.max(0, (circumference - count * minVisual) / count) : 0;
  const effectiveGap = count > 1 ? Math.min(gap, maxGap) : 0;
  const available = circumference - effectiveGap * count;

  const visuals = visible.map((segment) =>
    Math.max((total > 0 ? segment.value / total : 0) * available, minVisual),
  );

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

      dash: Math.max(visual - thickness, 0.01),

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
