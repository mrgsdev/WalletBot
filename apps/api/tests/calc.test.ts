import { describe, expect, it } from 'vitest';
import {
  MAX_AMOUNT,
  evaluateExpression,
  formatExpression,
  hasOperator,
  pushToken,
} from '@budget/shared';

describe('evaluateExpression', () => {
  it('считает пример с референса: 75 + 50 = 125', () => {
    expect(evaluateExpression('75+50')).toBe(125);
  });

  it('уважает приоритет умножения над сложением', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
    expect(evaluateExpression('10-2*3')).toBe(4);
  });

  it('понимает десятичную запятую', () => {
    expect(evaluateExpression('1499,90+0,10')).toBe(1500);
  });

  it('считает деление с округлением до копеек', () => {
    expect(evaluateExpression('100/3')).toBe(33.33);
  });

  it('делит счёт на несколько человек', () => {
    expect(evaluateExpression('3600/4')).toBe(900);
  });

  it('возвращает null для неполного выражения', () => {
    expect(evaluateExpression('75+')).toBeNull();
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('12,')).toBeNull();
  });

  it('возвращает null при делении на ноль', () => {
    expect(evaluateExpression('10/0')).toBeNull();
  });

  it('поддерживает ведущий минус', () => {
    expect(evaluateExpression('-50+70')).toBe(20);
  });

  it('отбрасывает мусорные символы', () => {
    expect(evaluateExpression('12a+3')).toBeNull();
  });

  it('обрабатывает цепочку операций', () => {
    expect(evaluateExpression('100+200-50+25')).toBe(275);
  });
});

describe('pushToken', () => {
  it('заменяет оператор, если нажали два подряд', () => {
    expect(pushToken('75+', '-')).toBe('75-');
  });

  it('не даёт начать выражение с оператора, кроме минуса', () => {
    expect(pushToken('', '+')).toBe('');
    expect(pushToken('', '-')).toBe('-');
  });

  it('не допускает двух точек в одном числе', () => {
    expect(pushToken('12.5', ',')).toBe('12.5');
    expect(pushToken('12', ',')).toBe('12.');
  });

  it('после оператора точка превращается в 0.', () => {
    expect(pushToken('50+', ',')).toBe('50+0.');
  });

  it('не даёт набрать ведущий ноль', () => {
    expect(pushToken('0', '5')).toBe('5');
  });
});

describe('hasOperator', () => {
  it('не считает ведущий минус оператором', () => {
    expect(hasOperator('-50')).toBe(false);
    expect(hasOperator('50-20')).toBe(true);
  });
});

describe('formatExpression', () => {
  it('показывает выражение в человеческом виде', () => {
    expect(formatExpression('75+50')).toBe('75 + 50');
    expect(formatExpression('12.5*2')).toBe('12,5 × 2');
  });
});

describe('pushToken: копейки', () => {
  it('не даёт набрать больше двух знаков после запятой', () => {
    let expr = '';
    for (const t of ['5', ',', '9', '9', '9']) expr = pushToken(expr, t);
    expect(expr).toBe('5.99');
  });

  it('ограничение действует для каждого числа в выражении', () => {
    let expr = '';
    for (const t of ['1', ',', '2', '3', '4', '+', '5', ',', '6', '7', '8']) expr = pushToken(expr, t);
    expect(expr).toBe('1.23+5.67');
  });

  it('запятая в пустом поле даёт «0,» — человек видит, что перешёл к копейкам', () => {
    expect(pushToken('', ',')).toBe('0.');
  });
});

describe('pushToken: предел суммы', () => {
  it('не даёт набрать больше девяти знаков в целой части', () => {
    let expr = '';
    for (let i = 0; i < 14; i++) expr = pushToken(expr, '2');
    expect(expr).toBe('222222222');
  });

  it('максимум с копейками набирается целиком', () => {
    let expr = '';
    for (const t of ['9','9','9','9','9','9','9','9','9',',','9','9']) expr = pushToken(expr, t);
    expect(expr).toBe('999999999.99');
    expect(evaluateExpression(expr)).toBe(MAX_AMOUNT);
  });

  it('предел действует для каждого слагаемого отдельно', () => {
    let expr = '';
    for (const t of ['1','2','3','+','9','9','9','9','9','9','9','9','9','9']) expr = pushToken(expr, t);
    expect(expr).toBe('123+999999999');
  });
});
