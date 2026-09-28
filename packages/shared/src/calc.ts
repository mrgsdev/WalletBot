export type Operator = '+' | '-' | '*' | '/';

const OPERATORS: Operator[] = ['+', '-', '*', '/'];

export function isOperator(char: string): char is Operator {
  return (OPERATORS as string[]).includes(char);
}

export function normalizeExpression(input: string): string {
  return input
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');
}

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

  let result = reduced[0] as number;
  for (let i = 1; i < reduced.length; i += 2) {
    const op = reduced[i] as Operator;
    const rhs = reduced[i + 1] as number;
    result = op === '+' ? result + rhs : result - rhs;
  }

  if (!Number.isFinite(result)) return null;
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

export function evaluatePartial(input: string): number | null {
  const expr = normalizeExpression(input);
  for (let end = expr.length; end > 0; end--) {
    const value = evaluateExpression(expr.slice(0, end));
    if (value !== null) return value;
  }
  return null;
}

export function hasOperator(input: string): boolean {
  const expr = normalizeExpression(input);

  return /[+\-*/]/.test(expr.slice(1));
}

export const MAX_AMOUNT = 999_999_999.99;

const MAX_WHOLE_DIGITS = 9;

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

  const lastNumber = expression.split(/[+\-*/]/).pop() ?? '';

  const dot = lastNumber.indexOf('.');
  if (dot !== -1 && lastNumber.length - dot - 1 >= 2) return expression;

  const whole = dot === -1 ? lastNumber : lastNumber.slice(0, dot);
  if (dot === -1 && whole.replace('-', '').length >= MAX_WHOLE_DIGITS) return expression;

  if (lastNumber === '0') return expression.slice(0, -1) + normalized;

  return expression + normalized;
}

export function formatExpression(expression: string): string {
  return expression
    .replace(/\./g, ',')
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/(?<=\d)\+/g, ' + ')
    .replace(/(?<=\d)-/g, ' − ');
}
