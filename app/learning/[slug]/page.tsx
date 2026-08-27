import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getContentDataSource } from '@/lib/content/data-source';
import { PostDetailPage, buildPostMetadata } from '@/components/post-detail';

type Params = { slug: string };

export const dynamic = 'force-dynamic';

function decodeSlugParam(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? value : decoded;
  } catch {
    return value;
  }
}

export default async function LearningDetailPage({ params }: { params: Promise<Params> }) {
  const { slug: rawSlug } = await params;
  return PostDetailPage({ slug: decodeSlugParam(rawSlug), kind: 'learning' });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlugParam(rawSlug);
  const repository = await getContentDataSource();
  const post = await repository.getPublishedPost(slug, 'learning');

  if (!post) {
    notFound();
  }

  return buildPostMetadata(post);
}
