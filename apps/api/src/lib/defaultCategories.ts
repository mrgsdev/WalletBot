/**
 * Дефолтный набор категорий.
 * Копируется каждому новому пользователю (личный бюджет) и каждой новой семье,
 * чтобы категории можно было переименовывать/архивировать независимо друг от друга.
 */

export interface DefaultCategory {
  name: string;
  type: 'income' | 'expense';
  group: string;
  icon: string;
  color: string;
}

/** Базовый цвет группы — им же красится сегмент в сводной статистике. */
export const GROUP_COLORS: Record<string, string> = {
  'Доходы': '#9BE870',
  'Обязательные платежи': '#5B5BD6',
  'Питание': '#FF9F6E',
  'Дом': '#6EC1FF',
  'Транспорт': '#7EE8C6',
  'Личное': '#B57BFF',
  'Семья и дети': '#FF6E8A',
  'Развлечения и хобби': '#E6E86E',
  'Работа/бизнес': '#7ED97E',
  'Прочее': '#8E8E93',
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ---------- Доходы ----------
  { name: 'Зарплата', type: 'income', group: 'Доходы', icon: '💼', color: '#9BE870' },
  { name: 'Подработка/фриланс', type: 'income', group: 'Доходы', icon: '🧑‍💻', color: '#7ED97E' },
  { name: 'Кэшбеки и проценты', type: 'income', group: 'Доходы', icon: '💸', color: '#6EE8A8' },
  { name: 'Прочие доходы', type: 'income', group: 'Доходы', icon: '🎁', color: '#B5E86E' },

  // ---------- Обязательные платежи ----------
  { name: 'Квартплата', type: 'expense', group: 'Обязательные платежи', icon: '🏠', color: '#5B5BD6' },
  { name: 'Коммуналка', type: 'expense', group: 'Обязательные платежи', icon: '💡', color: '#6E6EE0' },
  { name: 'Интернет и связь', type: 'expense', group: 'Обязательные платежи', icon: '📶', color: '#8080EA' },
  { name: 'Подписки', type: 'expense', group: 'Обязательные платежи', icon: '🔁', color: '#9393F0' },
  { name: 'Страховки', type: 'expense', group: 'Обязательные платежи', icon: '🛡', color: '#4A4AC4' },
  { name: 'Банковское обслуживание', type: 'expense', group: 'Обязательные платежи', icon: '🏦', color: '#3E3EB0' },

  // ---------- Питание ----------
  { name: 'Продукты', type: 'expense', group: 'Питание', icon: '🛒', color: '#FF9F6E' },
  { name: 'Готовая еда/доставка', type: 'expense', group: 'Питание', icon: '🥡', color: '#FFB185' },
  { name: 'Кафе и рестораны', type: 'expense', group: 'Питание', icon: '🍽', color: '#FF8A4D' },

  // ---------- Дом ----------
  { name: 'Хозтовары', type: 'expense', group: 'Дом', icon: '🧴', color: '#6EC1FF' },
  { name: 'Ремонт и мебель', type: 'expense', group: 'Дом', icon: '🛠', color: '#85CBFF' },
  { name: 'Аптечка', type: 'expense', group: 'Дом', icon: '💊', color: '#57B4F5' },
  { name: 'Питомцы', type: 'expense', group: 'Дом', icon: '🐾', color: '#43A6EC' },

  // ---------- Транспорт ----------
  { name: 'Бензин', type: 'expense', group: 'Транспорт', icon: '⛽️', color: '#7EE8C6' },
  { name: 'Обслуживание авто', type: 'expense', group: 'Транспорт', icon: '🚗', color: '#66DDB6' },
  { name: 'Такси/транспорт', type: 'expense', group: 'Транспорт', icon: '🚕', color: '#93EFD3' },
  { name: 'Штрафы', type: 'expense', group: 'Транспорт', icon: '🚨', color: '#4FCFA6' },

  // ---------- Личное ----------
  { name: 'Личные вещи', type: 'expense', group: 'Личное', icon: '👕', color: '#B57BFF' },
  { name: 'Уход за собой', type: 'expense', group: 'Личное', icon: '💅', color: '#C293FF' },
  { name: 'Здоровье', type: 'expense', group: 'Личное', icon: '🩺', color: '#A566F5' },
  { name: 'Образование', type: 'expense', group: 'Личное', icon: '📚', color: '#9553E8' },

  // ---------- Семья и дети ----------
  { name: 'Покупки детям', type: 'expense', group: 'Семья и дети', icon: '🧸', color: '#FF6E8A' },
  { name: 'Образование детей', type: 'expense', group: 'Семья и дети', icon: '🎒', color: '#FF87A0' },
  { name: 'Здоровье детей', type: 'expense', group: 'Семья и дети', icon: '🧑‍⚕️', color: '#F55574' },

  // ---------- Развлечения и хобби ----------
  { name: 'Хобби', type: 'expense', group: 'Развлечения и хобби', icon: '🎨', color: '#E6E86E' },
  { name: 'Путешествия и отдых', type: 'expense', group: 'Развлечения и хобби', icon: '✈️', color: '#EFF08A' },
  { name: 'Праздники и подарки', type: 'expense', group: 'Развлечения и хобби', icon: '🎉', color: '#DBDD55' },

  // ---------- Работа/бизнес ----------
  { name: 'Реклама', type: 'expense', group: 'Работа/бизнес', icon: '📣', color: '#7ED97E' },
  { name: 'Сервисы для работы', type: 'expense', group: 'Работа/бизнес', icon: '🧰', color: '#93E293' },
  { name: 'Налоги', type: 'expense', group: 'Работа/бизнес', icon: '🧾', color: '#68CC68' },

  // ---------- Прочее ----------
  { name: 'Незапланированное', type: 'expense', group: 'Прочее', icon: '❗️', color: '#8E8E93' },
  { name: 'Стройка/крупный ремонт', type: 'expense', group: 'Прочее', icon: '🏗', color: '#A0A0A6' },
  { name: 'Разное', type: 'expense', group: 'Прочее', icon: '📦', color: '#7A7A80' },
];

/** Порядок групп расходов в сводной статистике. */
export const EXPENSE_GROUP_ORDER = [
  'Обязательные платежи',
  'Питание',
  'Дом',
  'Транспорт',
  'Личное',
  'Семья и дети',
  'Развлечения и хобби',
  'Работа/бизнес',
  'Прочее',
];
