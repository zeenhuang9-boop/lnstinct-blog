import type { Metadata } from 'next';
import Link from 'next/link';

import { getAdminContentRepository } from '@/lib/content/admin-data-source';
import { requireAdmin } from '@/lib/auth/server';
import { SectionHeading } from '@/components/section-heading';
import { postKindLabel } from '@/lib/content/labels';
import { formatChinaDateTime } from '@/lib/date-time';

export const metadata: Metadata = {
  title: '内容管理',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = { status?: string; kind?: string };

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'trashed', label: '回收站' },
] as const;

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { status = 'all', kind = 'all' } = await searchParams;

  const repository = await getAdminContentRepository();
  const posts = await repository.listAllPosts();

  const filtered = posts.filter((post) => (status === 'all' || post.status === status) && (kind === 'all' || post.kind === kind));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>内容管理</SectionHeading>
        <Link
          href="/admin/posts/new"
          className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
        >
          + 新内容
        </Link>
      </div>

      <nav aria-label="状态筛选" className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const active = status === tab.value;
          return active ? (
            <span key={tab.value} className="border border-rust bg-rust px-3 py-1 text-xs text-paper dark:border-rust-soft dark:bg-rust-soft dark:text-night">
              {tab.label}
            </span>
          ) : (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/admin/posts' : `/admin/posts?status=${tab.value}`}
              className="border border-rule px-3 py-1 text-xs text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft"
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-rule px-4 py-10 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
          这里空空如也。
        </p>
      ) : (
        <ul className="divide-y divide-rule dark:divide-night-rule">
          {filtered.map((post) => (
            <li key={post.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="block truncate text-sm font-medium text-ink hover:text-rust dark:text-cream dark:hover:text-rust-soft"
                >
                  {post.title || '（未命名）'}
                </Link>
                <p className="mt-0.5 text-xs text-ink-soft dark:text-cream-soft">
                  {postKindLabel(post.kind)} · {post.publishedAt ? formatChinaDateTime(post.publishedAt) : '未发布'} · 更新于{' '}
                  {formatChinaDateTime(post.updatedAt)}
                </p>
              </div>
              <span
                className={`shrink-0 border px-2 py-0.5 text-xs ${
                  post.status === 'published'
                    ? 'border-rust text-rust dark:border-rust-soft dark:text-rust-soft'
                    : post.status === 'trashed'
                      ? 'border-rule text-ink-soft dark:border-night-rule dark:text-cream-soft'
                      : 'border-rule text-ink-soft dark:border-night-rule dark:text-cream-soft'
                }`}
              >
                {post.status === 'published' ? '已发布' : post.status === 'trashed' ? '回收站' : '草稿'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
