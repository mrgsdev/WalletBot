import { describe, expect, it } from 'vitest';
import { newUserMessage } from '../src/services/users.js';

describe('newUserMessage', () => {
  it('показывает имя и ссылку на профиль', () => {
    const text = newUserMessage({ name: 'Иван Петров', username: 'ivan', telegramId: '42' });
    expect(text).toContain('Иван Петров');
    expect(text).toContain('@ivan');
    expect(text).toContain('t.me/ivan');
    expect(text).toContain('начал пользоваться ботом');
  });

  it('без username показывает id — писать в профиль всё равно некуда', () => {
    const text = newUserMessage({ name: 'Без Ника', username: null, telegramId: '777' });
    expect(text).toContain('777');
    expect(text).not.toContain('t.me/');
  });

  it('экранирует HTML в имени: иначе parse_mode сломает разметку', () => {
    const text = newUserMessage({ name: '<b>Хакер</b> & Ко', username: null, telegramId: '1' });
    expect(text).toContain('&lt;b&gt;Хакер&lt;/b&gt; &amp; Ко');
    expect(text).not.toContain('<b>Хакер');
  });
});
