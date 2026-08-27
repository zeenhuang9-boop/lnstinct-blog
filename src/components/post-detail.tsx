import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Post, PostKind } from '@/domain/types';
import { getContentDataSource } from '@/lib/content/data-source';
import { ReadingProgress } from '@/components/reading-progress';
import { ShareActions } from '@/components/share-actions';
import { RichText } from '@/components/rich-text';
import { siteConfig } from '@/config/site';

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function sectionOf(kind: PostKind): { basePath: string; label: string } {
  return kind === 'learning' ? { basePath: '/learning', label: '学习记录' } : { basePath: '/articles', label: '文章' };
}

/**
 * 文章/学习记录详情页共用实现：读取已发布内容，缺失时 404。
 * 公开层文章与学习记录分属 /articles 与 /learning。
 */
export async function PostDetailPage({
  slug,
  kind,
}: {
  slug: string;
  kind: PostKind;
}): Promise<React.ReactElement> {
  const repository = await getContentDataSource();
  const post = await repository.getPublishedPost(slug, kind);

  if (!post) {
    notFound();
  }

  const { basePath, label } = sectionOf(post.kind);
  const date = post.publishedAt ?? post.createdAt;

  return (
    <article>
      <ReadingProgress />
      <nav aria-label="面包屑">
        <Link href={basePath} className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft">
          ← 返回{label}列表
        </Link>
      </nav>

      <header className="mt-6 border-b border-rule pb-6 dark:border-night-rule">
        <h1 className="font-serif text-3xl font-bold leading-snug text-ink dark:text-cream">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft dark:text-cream-soft">
          <time dateTime={date}>{formatDate(date)}</time>
        </div>
        {post.summary ? (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">{post.summary}</p>
        ) : null}
      </header>

      <div className="mt-8">
        <RichText doc={post.content} />
      </div>

      <footer className="mt-12 border-t border-rule pt-6 dark:border-night-rule">
        <ShareActions title={post.title} url={`${siteConfig.url}${basePath}/${post.slug}`} />
      </footer>
    </article>
  );
}

export function buildPostMetadata(post: Post): Metadata {
  const { basePath } = sectionOf(post.kind);
  const path = `${basePath}/${post.slug}`;

  return {
    title: post.title,
    description: post.summary ?? undefined,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.summary ?? undefined,
      type: 'article',
      url: path,
    },
  };
}
