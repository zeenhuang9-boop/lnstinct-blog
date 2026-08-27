import type { Post } from '@/domain/types';

import { EmptyState } from '@/components/empty-state';

function formatDate(post: Post): string {
  return (post.publishedAt ?? post.createdAt).slice(0, 10);
}

export function PostList({
  posts,
  basePath,
  emptyTitle = '还没有内容',
  emptyDescription = '发布后会出现在这里。',
  emptyAction,
}: {
  posts: Post[];
  basePath: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { href: string; label: string };
}) {
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <ul className="divide-y divide-rule dark:divide-night-rule">
      {posts.map((post) => (
        <li key={post.id} className="py-6">
          <article>
            <h3 className="font-serif text-lg font-bold">
              <a href={`${basePath}/${post.slug}`} className="text-ink hover:text-rust dark:text-cream dark:hover:text-rust-soft">
                {post.title}
              </a>
            </h3>
            <p className="mt-1 text-xs text-ink-soft dark:text-cream-soft">
              <time dateTime={post.publishedAt ?? post.createdAt}>{formatDate(post)}</time>
            </p>
            {post.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">{post.summary}</p>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
