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

  '🗂': vaultIcon,
};

export function AccountIcon({
  icon,
  color,
  className = 'h-8 w-8',
  emojiClassName = 'text-[15px]',
}: {
  icon: string;

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
