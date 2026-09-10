import { describe, expect, it } from 'vitest';
import {
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
