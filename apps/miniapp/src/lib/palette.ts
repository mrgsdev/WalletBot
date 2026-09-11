/**
 * Пастельная палитра для диаграмм.
 *
 * Цвета категорий в базе насыщенные — они хорошо работают точкой в списке,
 * но кольцо из шести таких цветов дерётся само с собой. Поэтому для графиков
 * мы приглушаем исходный цвет: оставляем оттенок (категория остаётся узнаваемой),
 * но сажаем насыщенность и поднимаем светлоту в пастельный диапазон.
 */

/** Запасные цвета — когда у категории цвет не задан или битый. */
const FALLBACK = [
  '#F2E3A6', // сливочно-жёлтый
  '#C9DDB6', // шалфей
  '#F3CBD9', // пыльно-розовый
  '#C6D8F0', // пудрово-голубой
  '#E3D2F2', // лиловый
  '#F7D7C0', // персиковый
  '#BEE1DA', // мятный
  '#EBD9B4', // песочный
];

const SATURATION = { min: 30, max: 50 };
const LIGHTNESS = { min: 70, max: 82 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.length === 6
        ? clean
        : null;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = (h * 60 + 360) % 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/**
 * Пастельная версия цвета: тот же оттенок, приглушённая насыщенность.
 * `seed` выбирает запасной цвет, если исходный не распознан.
 */
export function pastel(color: string | null | undefined, seed = 0): string {
  const rgb = color ? hexToRgb(color) : null;
  if (!rgb) return FALLBACK[Math.abs(seed) % FALLBACK.length];

  const [h, s, l] = rgbToHsl(...rgb);
  // Серый оставляем серым: подкручивать насыщенность там нечему.
  if (s < 8) return hslToHex(h, s, clamp(l, 74, 86));

  return hslToHex(h, clamp(s, SATURATION.min, SATURATION.max), clamp(l, LIGHTNESS.min, LIGHTNESS.max));
}

/**
 * Тот же оттенок, но заметно темнее — для текста и иконок поверх пастели.
 * Пастельная заливка светлая, чёрный по ней выглядит грубо.
 */
export function pastelInk(color: string | null | undefined, seed = 0): string {
  const rgb = hexToRgb(pastel(color, seed));
  if (!rgb) return '#4A4A52';
  const [h, s] = rgbToHsl(...rgb);
  return hslToHex(h, clamp(s + 10, 20, 45), 34);
}
