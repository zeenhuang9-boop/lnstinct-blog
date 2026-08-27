import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getContentDataSource } from '@/lib/content/data-source';
import { PostDetailPage, buildPostMetadata } from '@/components/post-detail';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

/**
 * Next 16.3（Turbopack）对非 ASCII 动态段传递的是未解码的百分号编码值，
 * 这里做一次安全解码；slug 由 slugifyTitle 生成，不含字面 %，解码不会误伤。
 */
function decodeSlugParam(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? value : decoded;
  } catch {
    return value;
  }
}

export default async function ArticleDetailPage({ params }: { params: Promise<Params> }) {
  const { slug: rawSlug } = await params;
  return PostDetailPage({ slug: decodeSlugParam(rawSlug), kind: 'article' });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const repository = await getContentDataSource();
  const post = await repository.getPublishedPost(slug, 'article');

  if (!post) {
    notFound();
  }

  return buildPostMetadata(post);
}
