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

export const CATEGORY_ICON_IMAGES: Record<string, string> = {
  '📶': wifiIcon,
  '🔁': phoneIcon,
  '🛠': repairIcon,
  '🥡': takeawayIcon,
  '🛡': insuranceIcon,
  '🚗': carIcon,
  '🚕': taxiIcon,
  '🩺': healthIcon,
  '📚': educationIcon,
  '🎒': educationKidsIcon,
  '🧸': kidsIcon,
  '🐾': petsIcon,
  '🎨': hobbyIcon,
  '👕': clothesIcon,
  '🏠': rentIcon,

  '✈️': travelIcon,
  '🏦': bankFeesIcon,
  '🧴': householdIcon,
  '🛒': groceriesIcon,
  '🧾': taxesIcon,
  '🍽': cafeIcon,
  '💊': pharmacyIcon,

  '🧑‍⚕️': healthKidsIcon,
  '💡': utilitiesIcon,
  '🧰': workIcon,
  '📣': adsIcon,
  '🎁': otherIncomeIcon,
  '💼': salaryIcon,

  '🧑‍💻': freelanceIcon,
  '💸': cashbackIcon,
  '📦': miscIcon,
  '🏗': constructionIcon,
  '🎉': holidaysIcon,

  '❗️': unplannedIcon,
  '💅': beautyIcon,

  '⛽️': fuelIcon,
  '🚨': finesIcon,
};

export function CategoryIcon({
  icon,
  color,
  className = 'h-10 w-10',
  emojiClassName = 'text-[18px]',
  rounded = 'full',
  bare = false,
}: {
  icon: string;

  color?: string;
  className?: string;
  emojiClassName?: string;

  rounded?: 'full' | 'squircle';

  bare?: boolean;
}) {
  const image = CATEGORY_ICON_IMAGES[icon];

  if (image) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center`}>
        <img src={image} alt="" className="h-[84%] w-[84%] object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`${rounded === 'squircle' ? 'squircle' : 'flex items-center justify-center rounded-full'} ${className} shrink-0 ${emojiClassName}`}
      style={
        bare
          ? undefined
          : { backgroundColor: color ? `${color}26` : 'rgb(var(--c-elevated))' }
      }
    >
      {icon}
    </span>
  );
}
