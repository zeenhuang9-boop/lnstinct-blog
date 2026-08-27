import { describe, expect, it } from 'vitest';

import {
  createSessionToken,
  signSessionBody,
  verifyAdminPassword,
  verifySessionToken,
} from '@/lib/auth/session';

describe('verifyAdminPassword', () => {
  it('接受正确密码，拒绝错误密码', () => {
    expect(verifyAdminPassword(process.env.ADMIN_PASSWORD || 'lnstinct-dev')).toBe(true);
    expect(verifyAdminPassword('wrong-password')).toBe(false);
  });

  it('拒绝空字符串', () => {
    expect(verifyAdminPassword('')).toBe(false);
  });
});

describe('会话令牌', () => {
  it('签发后可校验通过', () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it('篡改签名后校验失败', () => {
    const token = createSessionToken();
    const tampered = `${token.slice(0, -1)}X`;
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it('空值与垃圾输入校验失败', () => {
    expect(verifySessionToken(null)).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken('')).toBe(false);
    expect(verifySessionToken('not-a-token')).toBe(false);
  });

  it('过期会话校验失败', () => {
    const expired = Buffer.from(
      JSON.stringify({ v: 1, exp: Math.floor(Date.now() / 1000) - 10, nonce: 'x' }),
    ).toString('base64url');
    const signature = signSessionBody(expired);

    expect(verifySessionToken(`${expired}.${signature}`)).toBe(false);
  });
});
