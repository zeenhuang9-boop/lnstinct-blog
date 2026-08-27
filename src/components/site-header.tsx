'use client';

import { useState } from 'react';
import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { href: '/', label: '主页' },
  { href: '/learning', label: '学习记录' },
  { href: '/articles', label: '文章' },
  { href: '/projects', label: '项目' },
  { href: '/about', label: '关于' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-rule dark:border-night-rule">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="font-serif text-xl font-bold tracking-wide text-ink dark:text-cream">
          lnstinct.
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-6 sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors hover:text-rust dark:text-cream-soft dark:hover:text-rust-soft"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="打开菜单"
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex h-9 w-9 items-center justify-center border border-rule text-ink-soft dark:border-night-rule dark:text-cream-soft"
          >
            {open ? '×' : '☰'}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="移动端导航"
          className="flex flex-col gap-1 border-t border-rule px-4 py-3 sm:hidden dark:border-night-rule"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="py-2 text-base text-ink-soft dark:text-cream-soft"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
