import bagIcon from '../assets/bag.png';
import bankIcon from '../assets/bank.png';
import barsIcon from '../assets/bars.png';
import briefcaseIcon from '../assets/briefcase.png';
import cardIcon from '../assets/card.png';
import cashIcon from '../assets/cash.png';
import coinIcon from '../assets/coin.png';
import piggyIcon from '../assets/piggy.png';
import purseIcon from '../assets/purse.png';
import safeIcon from '../assets/safe.png';
import shoppingIcon from '../assets/shopping.png';
import suitcaseIcon from '../assets/suitcase.png';
import vaultIcon from '../assets/vault.png';

/**
 * Эмодзи счёта → объёмная иконка.
 *
 * Иконка счёта живёт в базе как эмодзи, и менять там данные ради оформления
 * не хочется: подменяем только отрисовку. Эмодзи остаётся ключом и запасным
 * вариантом — счёт со старой иконкой, которой нет в наборе, рисуется как раньше.
 */
export const ACCOUNT_ICON_IMAGES: Record<string, string> = {
  '💳': cardIcon,
  '💵': cashIcon,
  '💰': bagIcon,
  '🪙': coinIcon,
  '🥇': barsIcon,
  '🔐': safeIcon,
  '👛': purseIcon,
  '💼': briefcaseIcon,
  '🧳': suitcaseIcon,
  '🏦': bankIcon,
  '🐖': piggyIcon,
  '🛍': shoppingIcon,
  // Не иконка счёта, а псевдокарточка «Все счета» в сводке.
  '🗂': vaultIcon,
};

export function AccountIcon({
  icon,
  color,
  className = 'h-8 w-8',
  emojiClassName = 'text-[15px]',
}: {
  icon: string;
  /** Цвет счёта — подложка под эмодзи. У картинок свой цвет, подложка им не нужна. */
  color?: string;
  className?: string;
  emojiClassName?: string;
}) {
  const image = ACCOUNT_ICON_IMAGES[icon];

  if (image) {
    return <img src={image} alt="" className={`${className} shrink-0 object-contain`} />;
  }

  return (
    <span
      className={`squircle ${className} shrink-0 ${emojiClassName}`}
      style={{ backgroundColor: color ? `${color}26` : 'rgb(var(--c-elevated))' }}
    >
      {icon}
    </span>
  );
}
