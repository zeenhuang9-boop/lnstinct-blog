import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { sessionCookieName, verifySessionToken } from '@/lib/auth/session';

/** 服务端判断当前请求是否持有有效管理员会话。 */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(sessionCookieName)?.value);
}

/** 未登录时重定向到登录页；供后台布局、页面与 Server Action 统一调用。 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
}
