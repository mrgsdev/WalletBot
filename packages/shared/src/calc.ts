/**
 * Мини-калькулятор для экрана ввода операции.
 * Поддерживает + − × ÷ с приоритетом умножения/деления и десятичную запятую.
 * Живёт в общем пакете, чтобы логику можно было покрыть тестами на бэкенде.
 */

export type Operator = '+' | '-' | '*' | '/';

const OPERATORS: Operator[] = ['+', '-', '*', '/'];

export function isOperator(char: string): char is Operator {
  return (OPERATORS as string[]).includes(char);
}

/** Нормализует пользовательский ввод: запятая → точка, символы × ÷ − → * / -. */
export function normalizeExpression(input: string): string {
  return input
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');
}

/**
 * Вычисляет выражение. Возвращает null, если выражение неполное или некорректное
 * (например, «75+» или деление на ноль) — интерфейс в этом случае просто
 * не показывает результат.
 */
export function evaluateExpression(input: string): number | null {
  const expr = normalizeExpression(input);
  if (!expr) return null;

  const tokens: (number | Operator)[] = [];
  let current = '';

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (char >= '0' && char <= '9') {
      current += char;
      continue;
    }
    if (char === '.') {
      if (current.includes('.')) return null;
      current += current === '' ? '0.' : '.';
      continue;
    }
    if (isOperator(char)) {
      // Минус в начале выражения или сразу после оператора — знак числа.
      if (current === '' && char === '-' && (tokens.length === 0 || isOperator(tokens[tokens.length - 1] as Operator))) {
        current = '-';
        continue;
      }
      if (current === '' || current === '-' || current.endsWith('.')) return null;
      tokens.push(Number(current));
      tokens.push(char);
      current = '';
      continue;
    }
    return null;
  }

  if (current === '' || current === '-' || current.endsWith('.')) return null;
  tokens.push(Number(current));

  // Первый проход — умножение и деление.
  const reduced: (number | Operator)[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as Operator;
    const rhs = tokens[i + 1] as number;
    if (op === '*' || op === '/') {
      const lhs = reduced.pop() as number;
      if (op === '/' && rhs === 0) return null;
      reduced.push(op === '*' ? lhs * rhs : lhs / rhs);
    } else {
      reduced.push(op, rhs);
    }
  }

  // Второй проход — сложение и вычитание.
  let result = reduced[0] as number;
  for (let i = 1; i < reduced.length; i += 2) {
    const op = reduced[i] as Operator;
    const rhs = reduced[i + 1] as number;
    result = op === '+' ? result + rhs : result - rhs;
  }

  if (!Number.isFinite(result)) return null;
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

/** Содержит ли выражение хотя бы один оператор — нужно, чтобы решить, показывать ли строку выражения. */
export function hasOperator(input: string): boolean {
  const expr = normalizeExpression(input);
  // Ведущий минус оператором не считаем.
  return /[+\-*/]/.test(expr.slice(1));
}

/** Добавляет символ к выражению, не допуская двух операторов подряд и двух точек в числе. */
export function pushToken(expression: string, token: string): string {
  const normalized = normalizeExpression(token);

  if (isOperator(normalized)) {
    if (expression === '') return normalized === '-' ? '-' : '';
    const last = expression[expression.length - 1];
    if (isOperator(last)) return expression.slice(0, -1) + normalized;
    return expression + normalized;
  }

  if (normalized === '.') {
    const lastNumber = expression.split(/[+\-*/]/).pop() ?? '';
    if (lastNumber.includes('.')) return expression;
    return expression + (lastNumber === '' ? '0.' : '.');
  }

  // Не даём набирать «007».
  const lastNumber = expression.split(/[+\-*/]/).pop() ?? '';
  if (lastNumber === '0' && normalized !== '.') return expression.slice(0, -1) + normalized;

  return expression + normalized;
}

/** Красивое отображение выражения: точка → запятая, * → ×, / → ÷. */
export function formatExpression(expression: string): string {
  return expression
    .replace(/\./g, ',')
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/(?<=\d)\+/g, ' + ')
    .replace(/(?<=\d)-/g, ' − ');
}
