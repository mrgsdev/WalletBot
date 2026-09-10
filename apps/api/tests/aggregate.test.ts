import { describe, expect, it } from 'vitest';
import {
  type AggRow,
  aggregateByCategory,
  aggregateByGroup,
  buildTrend,
  computeTotals,
  inRange,
  makeConverter,
  percentChange,
  round2,
} from '../src/services/aggregate.js';

const USD_RATES = { USD: 1, EUR: 0.9, RUB: 90 };

function row(partial: Partial<AggRow>): AggRow {
  return {
    type: 'expense',
    date: new Date('2025-08-15T12:00:00Z'),
    amount: 100,
    accountCurrency: 'RUB',
    categoryId: 1,
    categoryName: 'Продукты',
    categoryIcon: '🛒',
    categoryColor: '#FF9F6E',
    categoryGroup: 'Питание',
    ...partial,
  };
}

describe('makeConverter', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');

  it('оставляет сумму без изменений, если валюта совпадает с базой', () => {
    expect(toRub(1234.56, 'RUB')).toBe(1234.56);
  });

  it('переводит через USD: 10 EUR = 1000 RUB при курсах 0.9 и 90', () => {
    expect(round2(toRub(10, 'EUR'))).toBe(1000);
  });

  it('возвращает сумму как есть для неизвестной валюты', () => {
    expect(toRub(50, 'XYZ')).toBe(50);
  });

  it('симметричен: перевод туда и обратно даёт исходную сумму', () => {
    const toEur = makeConverter(USD_RATES, 'EUR');
    expect(round2(toEur(toRub(10, 'EUR'), 'RUB'))).toBe(10);
  });
});

describe('aggregateByCategory', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');

  it('складывает операции одной категории и считает долю', () => {
    const result = aggregateByCategory(
      [
        row({ amount: 300 }),
        row({ amount: 200 }),
        row({ categoryId: 2, categoryName: 'Такси', amount: 500 }),
      ],
      toRub,
    );

    expect(result.total).toBe(1000);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].amount).toBe(500);
    expect(result.items[0].share).toBe(50);
    expect(result.items.map((i) => i.share).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('сортирует категории по убыванию суммы', () => {
    const result = aggregateByCategory(
      [
        row({ categoryId: 1, categoryName: 'Малая', amount: 100 }),
        row({ categoryId: 2, categoryName: 'Большая', amount: 900 }),
        row({ categoryId: 3, categoryName: 'Средняя', amount: 400 }),
      ],
      toRub,
    );
    expect(result.items.map((i) => i.name)).toEqual(['Большая', 'Средняя', 'Малая']);
  });

  it('приводит операции в разных валютах к базовой', () => {
    const result = aggregateByCategory(
      [row({ amount: 900 }), row({ amount: 10, accountCurrency: 'EUR' })],
      toRub,
    );
    expect(result.total).toBe(1900);
  });

  it('складывает операции без категории в отдельный бакет', () => {
    const result = aggregateByCategory(
      [row({ categoryId: null, categoryName: null, amount: 250 })],
      toRub,
    );
    expect(result.items[0].categoryId).toBeNull();
    expect(result.items[0].name).toBe('Без категории');
  });

  it('на пустом наборе возвращает нулевой итог без деления на ноль', () => {
    const result = aggregateByCategory([], toRub);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});

describe('computeTotals', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');

  it('считает накопления как положительную разницу дохода и расхода', () => {
    const totals = computeTotals(
      [row({ type: 'income', amount: 1000 }), row({ type: 'expense', amount: 400 })],
      toRub,
    );
    expect(totals.income).toBe(1000);
    expect(totals.expense).toBe(400);
    expect(totals.savings).toBe(600);
  });

  it('не уводит накопления в минус при перерасходе', () => {
    const totals = computeTotals(
      [row({ type: 'income', amount: 100 }), row({ type: 'expense', amount: 900 })],
      toRub,
    );
    expect(totals.savings).toBe(0);
  });

  it('доли в сумме дают 100% (с точностью до округления)', () => {
    const totals = computeTotals(
      [row({ type: 'income', amount: 1000 }), row({ type: 'expense', amount: 300 })],
      toRub,
    );
    const sum = totals.incomeShare + totals.expenseShare + totals.savingsShare;
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);
  });

  it('на пустом наборе даёт нули, а не NaN', () => {
    const totals = computeTotals([], toRub);
    expect(totals).toMatchObject({ income: 0, expense: 0, savings: 0, incomeShare: 0 });
  });
});

describe('aggregateByGroup', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');

  it('группирует расходы по крупным группам и игнорирует доходы', () => {
    const groups = aggregateByGroup(
      [
        row({ categoryGroup: 'Питание', amount: 600 }),
        row({ categoryGroup: 'Питание', amount: 400 }),
        row({ categoryGroup: 'Транспорт', amount: 1000 }),
        row({ type: 'income', categoryGroup: 'Доходы', amount: 5000 }),
      ],
      toRub,
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.amount)).toEqual([1000, 1000]);
    expect(groups.every((g) => g.share === 50)).toBe(true);
  });

  it('операции без группы попадают в «Прочее»', () => {
    const groups = aggregateByGroup([row({ categoryGroup: null, amount: 100 })], toRub);
    expect(groups[0].group).toBe('Прочее');
  });
});

describe('buildTrend', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');
  const months = [
    { year: 2025, month: 6, label: 'Июл', key: '2025-07' },
    { year: 2025, month: 7, label: 'Авг', key: '2025-08' },
    { year: 2025, month: 8, label: 'Сен', key: '2025-09' },
  ];

  it('раскладывает суммы по месяцам и заполняет пустые нулями', () => {
    const trend = buildTrend(
      [
        row({ type: 'income', date: new Date('2025-07-10T00:00:00Z'), amount: 100 }),
        row({ type: 'income', date: new Date('2025-09-01T00:00:00Z'), amount: 300 }),
        row({ type: 'income', date: new Date('2025-09-20T00:00:00Z'), amount: 200 }),
      ],
      months,
      'income',
      toRub,
    );

    expect(trend.map((p) => p.value)).toEqual([100, 0, 500]);
    expect(trend.map((p) => p.label)).toEqual(['Июл', 'Авг', 'Сен']);
  });

  it('не смешивает доходы и расходы', () => {
    const trend = buildTrend(
      [
        row({ type: 'expense', date: new Date('2025-08-05T00:00:00Z'), amount: 999 }),
        row({ type: 'income', date: new Date('2025-08-05T00:00:00Z'), amount: 111 }),
      ],
      months,
      'income',
      toRub,
    );
    expect(trend[1].value).toBe(111);
  });
});

describe('inRange', () => {
  it('включает границы диапазона', () => {
    const from = new Date('2025-08-01T00:00:00Z');
    const to = new Date('2025-08-31T23:59:59Z');
    const rows = [
      row({ date: from }),
      row({ date: to }),
      row({ date: new Date('2025-07-31T23:59:59Z') }),
      row({ date: new Date('2025-09-01T00:00:00Z') }),
    ];
    expect(inRange(rows, from, to)).toHaveLength(2);
  });
});

describe('round2', () => {
  it('округляет до копеек без плавающего мусора', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-2.345)).toBe(-2.34);
  });
});

describe('сравнение с предыдущим периодом', () => {
  const toRub = makeConverter(USD_RATES, 'RUB');

  it('считает рост и падение по категориям', () => {
    const now = [row({ categoryId: 1, amount: 1200 }), row({ categoryId: 2, categoryName: 'Такси', amount: 400 })];
    const before = [row({ categoryId: 1, amount: 1000 }), row({ categoryId: 2, categoryName: 'Такси', amount: 800 })];

    const { items } = aggregateByCategory(now, toRub, before);
    const products = items.find((i) => i.categoryId === 1)!;
    const taxi = items.find((i) => i.categoryId === 2)!;

    expect(products.previousAmount).toBe(1000);
    expect(products.changePercent).toBe(20);
    expect(taxi.previousAmount).toBe(800);
    expect(taxi.changePercent).toBe(-50);
  });

  it('новая категория не даёт процента — сравнивать не с чем', () => {
    const { items } = aggregateByCategory([row({ categoryId: 9, amount: 500 })], toRub, []);
    expect(items[0].previousAmount).toBe(0);
    expect(items[0].changePercent).toBeNull();
  });

  it('без предыдущего периода поля заполнены нулём и null', () => {
    const { items } = aggregateByCategory([row({ amount: 100 })], toRub);
    expect(items[0].previousAmount).toBe(0);
    expect(items[0].changePercent).toBeNull();
  });

  it('исчезнувшая категория не попадает в результат', () => {
    // Тратили в прошлом месяце, в этом — нет: показывать нечего.
    const { items } = aggregateByCategory([], toRub, [row({ categoryId: 5, amount: 700 })]);
    expect(items).toEqual([]);
  });

  it('сравнение приводит валюты к базовой', () => {
    const now = [row({ amount: 1800 })];
    const before = [row({ amount: 10, accountCurrency: 'EUR' })]; // 10 EUR = 1000 RUB
    const { items } = aggregateByCategory(now, toRub, before);
    expect(items[0].previousAmount).toBe(1000);
    expect(items[0].changePercent).toBe(80);
  });
});

describe('percentChange', () => {
  it('обычный рост и падение', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
  });

  it('от нуля процент не считается', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it('падение до нуля — минус сто процентов', () => {
    expect(percentChange(0, 800)).toBe(-100);
  });
});
