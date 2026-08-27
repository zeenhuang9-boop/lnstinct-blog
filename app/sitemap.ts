import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import { getContentDataSource } from '@/lib/content/data-source';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const repository = await getContentDataSource();

  const [articles, learning] = await Promise.all([
    repository.listPublishedPosts({ kind: 'article' }),
    repository.listPublishedPosts({ kind: 'learning' }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/learning`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/articles`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/projects`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const postRoutes: MetadataRoute.Sitemap = [...articles, ...learning].map((post) => ({
    url: `${base}${post.kind === 'learning' ? '/learning' : '/articles'}/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
