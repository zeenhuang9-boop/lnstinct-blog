import Link from 'next/link';

import { requireAdmin } from '@/lib/auth/server';
import { logoutAction } from '@/lib/actions/auth';

const navItems = [
  { href: '/admin', label: '概览' },
  { href: '/admin/posts', label: '内容' },
  { href: '/admin/projects', label: '项目' },
];

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4 dark:border-night-rule">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-serif text-xl font-bold text-ink dark:text-cream">
            lnstinct. 后台
          </Link>
          <nav aria-label="后台导航" className="flex items-center gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-ink-soft transition-colors hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" target="_blank" className="text-sm text-ink-soft hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft">
            查看站点 ↗
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-ink-soft hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft">
              退出登录
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
