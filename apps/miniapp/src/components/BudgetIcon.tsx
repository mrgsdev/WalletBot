import chessIcon from '../assets/budgets/chess.png';
import councilIcon from '../assets/budgets/council.png';
import crown2Icon from '../assets/budgets/crown2.png';
import crownIcon from '../assets/budgets/crown.png';
import girlIcon from '../assets/budgets/girl.png';
import kingIcon from '../assets/budgets/king.png';
import ladyIcon from '../assets/budgets/lady.png';
import nobleIcon from '../assets/budgets/noble.png';
import palaceIcon from '../assets/budgets/palace.png';
import princeIcon from '../assets/budgets/prince.png';
import queenIcon from '../assets/budgets/queen.png';
import rulerIcon from '../assets/budgets/ruler.png';
import tiaraIcon from '../assets/budgets/tiara.png';

/**
 * Иконка бюджета.
 *
 * В отличие от счетов и категорий, ключ здесь — не эмодзи, а короткий
 * идентификатор: картинки одной темы, подобрать им тринадцать разных
 * осмысленных эмодзи всё равно не вышло бы. В базе поле `icon` — строка
 * до 8 символов, коды в неё помещаются.
 *
 * Бюджеты, созданные раньше, хранят эмодзи (👛, 👨‍👩‍👧) — они и дальше
 * рисуются как эмодзи через запасную ветку.
 */
export const BUDGET_ICON_IMAGES: Record<string, string> = {
  crown: crownIcon,
  crown2: crown2Icon,
  tiara: tiaraIcon,
  chess: chessIcon,
  king: kingIcon,
  queen: queenIcon,
  lady: ladyIcon,
  noble: nobleIcon,
  ruler: rulerIcon,
  girl: girlIcon,
  prince: princeIcon,
  council: councilIcon,
  palace: palaceIcon,
};

/** Порядок в выборе иконки. */
export const BUDGET_ICON_KEYS = Object.keys(BUDGET_ICON_IMAGES);

export function BudgetIcon({
  icon,
  className = 'h-10 w-10',
  emojiClassName = 'text-[18px]',
}: {
  icon: string;
  className?: string;
  emojiClassName?: string;
}) {
  const image = BUDGET_ICON_IMAGES[icon];

  if (image) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center`}>
        <img src={image} alt="" className="h-[88%] w-[88%] object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-elevated ${className} ${emojiClassName}`}
    >
      {icon}
    </span>
  );
}
