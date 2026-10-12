'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 「她」三页共用的子导航：我们 / 照片墙 / 信。
 *
 * 为什么这一层是客户端组件：Next 16 的 layout 不随导航重渲染，也拿不到 pathname
 * （见 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
 * 的「Pathname」一节），而当前项要真实高亮并带 `aria-current="page"`，只能在
 * `usePathname()` 里判断。
 *
 * 它是叶子组件：不接收 props、不引任何内容数据，`app/her` 下的三个 page 仍然是服务器组件。
 */
const herNavItems = [
  { href: '/her', label: '我们' },
  { href: '/her/photos', label: '照片墙' },
  { href: '/her/letter', label: '信' },
] as const;

const linkBase = 'border-b-2 pb-1 text-sm transition-colors';
const linkCurrent = `${linkBase} border-rust font-bold text-ink dark:border-rust-soft dark:text-cream`;
const linkIdle = `${linkBase} border-transparent text-ink-soft hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft`;

export function HerSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="「她」的子导航" className="flex items-center gap-7 sm:gap-8">
      {herNavItems.map((item) => {
        const current = pathname === item.href || pathname === `${item.href}/`;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={current ? linkCurrent : linkIdle}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
