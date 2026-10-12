import type { Metadata } from 'next';

import { HerSubnav } from '@/components/her/her-subnav';

/**
 * 「她」三页共用的外壳：子导航（我们 / 照片墙 / 信）+ 页脚上方那行可见性说明。
 *
 * 这个路由不进主导航、不进 sitemap；`robots` 在这里声明一次，三个 page 各自
 * 也声明一次（同值），将来即使有人只复制走一个 page，保险丝也还在。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function HerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-10">
      <HerSubnav />
      {children}
      <p className="border-t border-rule pt-4 text-xs text-ink-soft dark:border-night-rule dark:text-cream-soft">
        本页仅本机可见 · 未进主导航
      </p>
    </div>
  );
}
