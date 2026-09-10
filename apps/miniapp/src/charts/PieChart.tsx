import { motion } from 'framer-motion';

export interface PieSlice {
  id: string;
  value: number;
  color: string;
}

interface Props {
  slices: PieSlice[];
  size?: number;
  /** Зазор между дольками в градусах. */
  gapDegrees?: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const from = polar(cx, cy, r, end);
  const to = polar(cx, cy, r, start);
  const largeArc = end - start <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 0 ${to.x} ${to.y} Z`;
}

/**
 * Маленькая круговая диаграмма Доход / Расход / Накопления
 * с зазорами между дольками — как на референсном экране сводки.
 */
export function PieChart({ slices, size = 120, gapDegrees = 4 }: Props) {
  const total = slices.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  const visible = slices.filter((s) => s.value > 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  if (total === 0 || visible.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="rgb(var(--c-elevated))" opacity={0.5} />
      </svg>
    );
  }

  const gap = visible.length > 1 ? gapDegrees : 0;
  let angle = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {visible.map((slice, index) => {
        const sweep = (slice.value / total) * (360 - gap * visible.length);
        const start = angle + gap / 2;
        const end = start + sweep;
        angle = end + gap / 2;
        return (
          <motion.path
            key={slice.id}
            d={slicePath(cx, cy, r, start, end)}
            fill={slice.color}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 160, damping: 18 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
    </svg>
  );
}
