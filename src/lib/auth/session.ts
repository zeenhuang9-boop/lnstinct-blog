import { createHmac, timingSafeEqual } from 'node:crypto';
/**
 * 本地管理员认证：密码来自 ADMIN_PASSWORD 环境变量；
 * 未配置时使用文档化的本地开发默认值，登录页会提示正式使用需配置。
 * 会话为 HMAC-SHA256 签名的 httpOnly cookie，服务端每次校验。
 */

const SESSION_COOKIE = 'lnstinct-admin-session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** 本地开发默认密码（无敏感信息，仅用于本地验收；正式使用必须配置 ADMIN_PASSWORD）。 */
const DEV_FALLBACK_PASSWORD = 'lnstinct-dev';
const DEV_FALLBACK_SECRET = 'lnstinct-local-dev-secret';

export function getAdminPassword(): string {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  return fromEnv || DEV_FALLBACK_PASSWORD;
}

function getSessionSecret(): string {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim();
  return fromEnv || DEV_FALLBACK_SECRET;
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  const actual = Buffer.from(candidate);
  const target = Buffer.from(expected);

  return actual.length === target.length && timingSafeEqual(actual, target);
}

export type SessionPayload = {
  v: 1;
  exp: number;
  nonce: string;
};

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

/** 供内部与测试复用：对会话载荷体签名。 */
export function signSessionBody(body: string): string {
  return sign(body);
}

/** 签发签名会话 cookie 值。 */
export function createSessionToken(): string {
  const payload: SessionPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    nonce: Math.random().toString(36).slice(2),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** 校验签名与有效期；返回 true 表示会话有效。 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) {
    return false;
  }

  const dot = token.lastIndexOf('.');

  if (dot <= 0) {
    return false;
  }

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    return payload.v === 1 && typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAgeSeconds = SESSION_MAX_AGE_SECONDS;
