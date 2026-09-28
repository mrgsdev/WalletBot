import crypto from 'node:crypto';

export interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramInitUser;
  authDate: number;
  startParam?: string;
  raw: string;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
): ParsedInitData | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  const buildCheckString = (skipSignature: boolean) =>
    [...params.entries()]
      .filter(([key]) => key !== 'hash' && !(skipSignature && key === 'signature'))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

  const matches = (checkString: string) => {
    const computed = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  const hasSignature = params.has('signature');
  if (!matches(buildCheckString(false)) && !(hasSignature && matches(buildCheckString(true)))) {
    return null;
  }

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate) return null;
  if (maxAgeSec > 0 && Date.now() / 1000 - authDate > maxAgeSec) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  let user: TelegramInitUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!user?.id) return null;

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
    raw: initData,
  };
}

export function displayName(user: TelegramInitUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || user.username || `User ${user.id}`;
}

export function generateInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
