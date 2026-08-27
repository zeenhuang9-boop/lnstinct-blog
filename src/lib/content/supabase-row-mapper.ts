import type { Post, PostKind, Project } from '@/domain/types';

/** 将 Supabase 的 snake_case 行映射为领域模型。 */
export function mapPostRow(row: Record<string, unknown>): Post {
  return {
    id: String(row.id),
    slug: String(row.slug),
    kind: String(row.kind) as PostKind,
    title: String(row.title),
    summary: row.summary == null ? null : String(row.summary),
    content: (row.content ?? { type: 'doc', content: [] }) as Post['content'],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    status: String(row.status) as Post['status'],
    publishedAt: row.published_at == null ? null : String(row.published_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** 将 Supabase 的 snake_case 项目行映射为领域模型。 */
export function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    repositoryUrl: String(row.repository_url),
    liveUrl: row.live_url == null ? null : String(row.live_url),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    featured: Boolean(row.featured),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
