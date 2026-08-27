'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  createSessionToken,
  sessionCookieName,
  sessionMaxAgeSeconds,
  verifyAdminPassword,
} from '@/lib/auth/session';

export type LoginState = { error?: string };

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') ?? '');

  if (!verifyAdminPassword(password)) {
    return { error: '密码不正确，请重试。' };
  }

  const store = await cookies();
  store.set(sessionCookieName, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 本地验收运行在 http://localhost；部署到 HTTPS 前保持 false。
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  });

  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(sessionCookieName);
  redirect('/admin/login');
}
