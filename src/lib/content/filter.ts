import type { Post, PostKind } from '@/domain/types';

export type PostQuery = {
  kind: PostKind;
  q?: string;
  tag?: string;
};

/**
 * 列表页共用过滤：只暴露已发布内容，查询词命中标题或摘要，标签精确匹配。
 */
export function filterPublishedPosts(posts: readonly Post[], query: PostQuery): Post[] {
  const keyword = query.q?.trim().toLowerCase();

  return posts
    .filter((post) => post.status === 'published')
    .filter((post) => post.kind === query.kind)
    .filter((post) => !keyword || post.title.toLowerCase().includes(keyword) || (post.summary ?? '').toLowerCase().includes(keyword))
    .filter((post) => !query.tag || post.tags.includes(query.tag))
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}
