import { motion } from 'framer-motion';
import { useId } from 'react';
import { pastel, pastelInk } from '../lib/palette';

export interface TrendDatum {
  label: string;
  value: number;
}

interface Props {
  data: TrendDatum[];
  color?: string;
  height?: number;
  /** Индекс подсвеченной точки; по умолчанию — последняя. */
  activeIndex?: number;
  onSelect?: (index: number) => void;
  showArea?: boolean;
}

/**
 * Сглаженная линия тренда (кривая Catmull-Rom, переведённая в кубические Безье) —
 * без резких углов, как на референсе.
 */
export function TrendLine({
  data,
  color = '#D8F24A',
  height = 96,
  activeIndex,
  onSelect,
  showArea = true,
}: Props) {
  const gradientId = useId();
  // Заливка — пастельная, сама линия темнее того же оттенка: так график
  // остаётся читаемым и не выбивается из палитры остальных диаграмм.
  const areaColor = pastel(color);
  const lineColor = pastelInk(color);
  const width = 320;
  const padY = 14;
  const padX = 10;

  if (data.length === 0) {
    return <div style={{ height }} className="rounded-2xl bg-elevated/40" />;
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || Math.max(max, 1);

  const points = data.map((d, i) => {
    const x = padX + (i * (width - padX * 2)) / Math.max(data.length - 1, 1);
    const y = height - padY - ((d.value - min) / span) * (height - padY * 2);
    return { x, y };
  });

  const path = smoothPath(points);
  const areaPath = `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const active = activeIndex ?? data.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={areaColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={areaColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showArea && <path d={areaPath} fill={`url(#${gradientId})`} />}

      <motion.path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        vectorEffect="non-scaling-stroke"
      />

      {points[active] && (
        <motion.circle
          cx={points[active].x}
          cy={points[active].y}
          r={5}
          fill={lineColor}
          stroke="rgb(var(--c-surface))"
          strokeWidth={3}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 18 }}
        />
      )}

      {/* Прозрачные зоны для тапа по месяцу. */}
      {onSelect &&
        points.map((p, i) => (
          <rect
            key={i}
            x={p.x - (width / data.length) / 2}
            y={0}
            width={width / data.length}
            height={height}
            fill="transparent"
            onClick={() => onSelect(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}
    </svg>
  );
}

/** Catmull-Rom → кубический Безье: даёт плавную кривую через все точки. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) {
    const p = points[0];
    return p ? `M ${p.x} ${p.y}` : '';
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const tension = 6;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
