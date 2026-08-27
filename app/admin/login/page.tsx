import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { isAdmin } from '@/lib/auth/server';
import { LoginForm } from '@/components/admin/login-form';
import { getAdminPassword } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: '登录',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect('/admin');
  }

  const usesDevPassword = process.env.ADMIN_PASSWORD === undefined;

  return (
    <div className="mx-auto max-w-sm">
      <div className="border border-rule p-6 dark:border-night-rule">
        <h1 className="font-serif text-2xl font-bold text-ink dark:text-cream">管理员登录</h1>
        <p className="mt-1 text-xs text-ink-soft dark:text-cream-soft">仅限站长本人，无公开注册。</p>
        <div className="mt-5">
          <LoginForm />
        </div>
        {usesDevPassword ? (
          <p className="mt-4 border border-dashed border-rule px-3 py-2 text-xs text-ink-soft dark:border-night-rule dark:text-cream-soft">
            当前使用本地默认密码：<code className="font-mono">{getAdminPassword()}</code>。正式使用请在
            <code className="font-mono"> .env.local</code> 中配置 <code className="font-mono">ADMIN_PASSWORD</code>。
          </p>
        ) : null}
      </div>
    </div>
  );
}
