import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyInitData } from '../src/lib/telegram.js';

const TOKEN = '123456:TEST-TOKEN-FOR-UNIT-TESTS';

/** Собирает initData с корректной подписью — так его формирует Telegram. */
function sign(fields: Record<string, string>, opts: { excludeSignature?: boolean } = {}) {
  const dcs = Object.keys(fields)
    .filter((k) => k !== 'hash' && !(opts.excludeSignature && k === 'signature'))
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');

  return new URLSearchParams({ ...fields, hash }).toString();
}

const user = JSON.stringify({ id: 42, first_name: 'Тест', username: 'tester' });
const now = () => String(Math.floor(Date.now() / 1000));

describe('verifyInitData', () => {
  it('принимает корректно подписанные данные', () => {
    const data = sign({ user, auth_date: now(), query_id: 'AAxxx' });
    const parsed = verifyInitData(data, TOKEN);
    expect(parsed?.user.id).toBe(42);
    expect(parsed?.user.first_name).toBe('Тест');
  });

  it('отвергает подделанную подпись', () => {
    const data = sign({ user, auth_date: now() }).replace(/hash=.*/, 'hash=' + 'a'.repeat(64));
    expect(verifyInitData(data, TOKEN)).toBeNull();
  });

  it('отвергает данные, подписанные другим токеном', () => {
    const data = sign({ user, auth_date: now() });
    expect(verifyInitData(data, 'другой:токен')).toBeNull();
  });

  it('отвергает подменённого пользователя', () => {
    const data = sign({ user, auth_date: now() });
    const tampered = data.replace(encodeURIComponent(user), encodeURIComponent(
      JSON.stringify({ id: 999, first_name: 'Взлом' }),
    ));
    expect(verifyInitData(tampered, TOKEN)).toBeNull();
  });

  it('отвергает просроченные данные', () => {
    const old = String(Math.floor(Date.now() / 1000) - 60 * 60 * 48);
    const data = sign({ user, auth_date: old });
    expect(verifyInitData(data, TOKEN, 3600)).toBeNull();
  });

  it('принимает поле signature, включённое в подпись (Bot API 7.10+)', () => {
    const data = sign({ user, auth_date: now(), signature: 'ed25519-подпись' });
    expect(verifyInitData(data, TOKEN)?.user.id).toBe(42);
  });

  it('принимает и вариант, где signature из подписи исключён', () => {
    const data = sign({ user, auth_date: now(), signature: 'ed25519-подпись' }, { excludeSignature: true });
    expect(verifyInitData(data, TOKEN)?.user.id).toBe(42);
  });

  it('возвращает start_param для инвайт-ссылок', () => {
    const data = sign({ user, auth_date: now(), start_param: 'join_ABCD1234' });
    expect(verifyInitData(data, TOKEN)?.startParam).toBe('join_ABCD1234');
  });

  it('отвергает пустые данные и пустой токен', () => {
    expect(verifyInitData('', TOKEN)).toBeNull();
    expect(verifyInitData(sign({ user, auth_date: now() }), '')).toBeNull();
  });

  it('отвергает данные без пользователя', () => {
    const data = sign({ auth_date: now() });
    expect(verifyInitData(data, TOKEN)).toBeNull();
  });
});
