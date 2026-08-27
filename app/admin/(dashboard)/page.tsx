import type { Metadata } from 'next';
import Link from 'next/link';

import { getAdminContentRepository } from '@/lib/content/admin-data-source';
import { requireAdmin } from '@/lib/auth/server';
import { SectionHeading } from '@/components/section-heading';

export const metadata: Metadata = {
  title: '概览',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdmin();
  const repository = await getAdminContentRepository();
  const posts = await repository.listAllPosts();

  const drafts = posts.filter((post) => post.status === 'draft');
  const published = posts.filter((post) => post.status === 'published');
  const trashed = posts.filter((post) => post.status === 'trashed');
  const projects = await repository.listAllProjects();

  const recent = [...posts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const stats = [
    { label: '草稿', value: drafts.length, href: '/admin/posts?status=draft' },
    { label: '已发布', value: published.length, href: '/admin/posts?status=published' },
    { label: '回收站', value: trashed.length, href: '/admin/posts?status=trashed' },
    { label: '项目', value: projects.length, href: '/admin/projects' },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="border border-rule p-4 text-center transition-colors hover:border-rust dark:border-night-rule dark:hover:border-rust-soft"
          >
            <p className="font-serif text-3xl font-bold text-ink dark:text-cream">{stat.value}</p>
            <p className="mt-1 text-xs text-ink-soft dark:text-cream-soft">{stat.label}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="recent-title">
        <SectionHeading id="recent-title">最近编辑</SectionHeading>
        {recent.length > 0 ? (
          <ul className="divide-y divide-rule dark:divide-night-rule">
            {recent.map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-3 py-3">
                <Link href={`/admin/posts/${post.id}`} className="truncate text-sm text-ink hover:text-rust dark:text-cream dark:hover:text-rust-soft">
                  {post.title || '（未命名）'}
                </Link>
                <span className="shrink-0 text-xs text-ink-soft dark:text-cream-soft">
                  {post.kind === 'article' ? '文章' : '散文'} ·{' '}
                  {post.status === 'published' ? '已发布' : post.status === 'draft' ? '草稿' : '回收站'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-rule px-4 py-8 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
            还没有内容，先写一篇吧。
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/posts/new"
          className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
        >
          + 新内容
        </Link>
        <Link
          href="/admin/projects/new"
          className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          + 新项目
        </Link>
      </div>
    </div>
  );
}
