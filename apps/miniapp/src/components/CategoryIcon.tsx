import petsIcon from '../assets/categories/pets.png';
import pharmacyIcon from '../assets/categories/pharmacy.png';
import phoneIcon from '../assets/categories/phone.png';
import rentIcon from '../assets/categories/rent.png';
import repairIcon from '../assets/categories/repair.png';
import salaryIcon from '../assets/categories/salary.png';
import adsIcon from '../assets/categories/ads.png';
import bankFeesIcon from '../assets/categories/bank-fees.png';
import beautyIcon from '../assets/categories/beauty.png';
import cafeIcon from '../assets/categories/cafe.png';
import carIcon from '../assets/categories/car.png';
import cashbackIcon from '../assets/categories/cashback.png';
import educationKidsIcon from '../assets/categories/education-kids.png';
import clothesIcon from '../assets/categories/clothes.png';
import constructionIcon from '../assets/categories/construction.png';
import educationIcon from '../assets/categories/education.png';
import kidsIcon from '../assets/categories/kids.png';
import finesIcon from '../assets/categories/fines.png';
import freelanceIcon from '../assets/categories/freelance.png';
import fuelIcon from '../assets/categories/fuel.png';
import miscIcon from '../assets/categories/misc.png';
import otherIncomeIcon from '../assets/categories/other-income.png';
import groceriesIcon from '../assets/categories/groceries.png';
import healthKidsIcon from '../assets/categories/health-kids.png';
import healthIcon from '../assets/categories/health.png';
import holidaysIcon from '../assets/categories/holidays.png';
import householdIcon from '../assets/categories/household.png';
import hobbyIcon from '../assets/categories/hobby.png';
import insuranceIcon from '../assets/categories/insurance.png';
import takeawayIcon from '../assets/categories/takeaway.png';
import taxesIcon from '../assets/categories/taxes.png';
import travelIcon from '../assets/categories/travel.png';
import unplannedIcon from '../assets/categories/unplanned.png';
import utilitiesIcon from '../assets/categories/utilities.png';
import workIcon from '../assets/categories/work.png';
import taxiIcon from '../assets/categories/taxi.png';
import wifiIcon from '../assets/categories/wifi.png';

/**
 * Эмодзи категории → объёмная иконка.
 *
 * Устроено так же, как AccountIcon: иконка категории лежит в базе эмодзи,
 * менять данные ради оформления не нужно — подменяем только отрисовку.
 * Категории без картинки продолжают рисоваться эмодзи в тонированном кружке.
 */
export const CATEGORY_ICON_IMAGES: Record<string, string> = {
  '📶': wifiIcon,   // Интернет и связь
  '🔁': phoneIcon,  // Подписки
  '🛠': repairIcon,  // Ремонт и мебель
  '🥡': takeawayIcon,  // Готовая еда/доставка
  '🛡': insuranceIcon,  // Страховки
  '🚗': carIcon,  // Обслуживание авто
  '🚕': taxiIcon,  // Такси/транспорт
  '🩺': healthIcon,  // Здоровье
  '📚': educationIcon,  // Образование
  '🎒': educationKidsIcon,  // Образование детей
  '🧸': kidsIcon,  // Покупки детям
  '🐾': petsIcon,  // Питомцы
  '🎨': hobbyIcon,  // Хобби
  '👕': clothesIcon,  // Личные вещи
  '🏠': rentIcon,  // Квартплата
  // Ключ из двух точек: ✈ + невидимый селектор варианта U+FE0F. Не «чистить».
  '✈️': travelIcon,  // Путешествия и отдых
  '🏦': bankFeesIcon,  // Банковское обслуживание
  '🧴': householdIcon,  // Хозтовары
  '🛒': groceriesIcon,  // Продукты
  '🧾': taxesIcon,  // Налоги
  '🍽': cafeIcon,  // Кафе и рестораны
  '💊': pharmacyIcon,  // Аптечка
  // ZWJ-последовательность: 🧑 + U+200D + ⚕ + U+FE0F. Соединитель невидим — не терять.
  '🧑‍⚕️': healthKidsIcon,  // Здоровье детей
  '💡': utilitiesIcon,  // Коммуналка
  '🧰': workIcon,  // Сервисы для работы
  '📣': adsIcon,  // Реклама
  '🎁': otherIncomeIcon,  // Прочие доходы
  '💼': salaryIcon,  // Зарплата
  // ZWJ-последовательность: 🧑 + U+200D + 💻. Соединитель невидим — не терять.
  '🧑‍💻': freelanceIcon,  // Подработка/фриланс
  '💸': cashbackIcon,  // Кэшбеки и проценты
  '📦': miscIcon,  // Разное
  '🏗': constructionIcon,  // Стройка/крупный ремонт
  '🎉': holidaysIcon,  // Праздники и подарки
  // ❗ + невидимый селектор варианта U+FE0F.
  '❗️': unplannedIcon,  // Незапланированное
  '💅': beautyIcon,  // Уход за собой
  // ⛽ + невидимый селектор варианта U+FE0F.
  '⛽️': fuelIcon,  // Бензин
  '🚨': finesIcon,  // Штрафы
};

export function CategoryIcon({
  icon,
  color,
  className = 'h-10 w-10',
  emojiClassName = 'text-[18px]',
  rounded = 'full',
}: {
  icon: string;
  /** Цвет категории — подложка под эмодзи. У картинок свой цвет, подложка им не нужна. */
  color?: string;
  className?: string;
  emojiClassName?: string;
  /** Форма подложки под эмодзи: кружок в списках, сквиркл в строке операции. */
  rounded?: 'full' | 'squircle';
}) {
  const image = CATEGORY_ICON_IMAGES[icon];

  if (image) {
    /*
     * Эмодзи сидит в тонированном кружке с воздухом по краям, а картинка
     * без отступа заняла бы ячейку целиком и выглядела бы крупнее соседей.
     *
     * Отступ задаём вложенным размером, а не padding в процентах: у padding
     * проценты считаются от ширины РОДИТЕЛЯ, и в центрированном контейнере
     * иконка схлопывалась почти в точку.
     */
    return (
      <span className={`${className} flex shrink-0 items-center justify-center`}>
        <img src={image} alt="" className="h-[84%] w-[84%] object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`${rounded === 'squircle' ? 'squircle' : 'flex items-center justify-center rounded-full'} ${className} shrink-0 ${emojiClassName}`}
      style={{ backgroundColor: color ? `${color}26` : 'rgb(var(--c-elevated))' }}
    >
      {icon}
    </span>
  );
}
