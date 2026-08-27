import type { ContentRepository, PostQuery } from '@/lib/content/repository';
import { filterPublishedPosts } from '@/lib/content/filter';
import type { Post, PostKind, Project } from '@/domain/types';

/**
 * Supabase 仓储的公开读实现。
 * 只有 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 都配置时才被创建；
 * 应用不持有 service-role key，所有读走 RLS：匿名仅能读 published。
 */
export function createSupabaseContentRepository(): ContentRepository {
  return {
    async listPublishedPosts(query: PostQuery) {
      const { createPublicClient } = await import('@/lib/supabase/client');
      const supabase = createPublicClient();

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .eq('kind', query.kind)
        .order('published_at', { ascending: false });

      if (error) {
        return [];
      }

      return filterPublishedPosts(
        (data as Post[]).map(mapPostRow),
        query,
      );
    },

    async getPublishedPost(slug: string, kind: PostKind) {
      const { createPublicClient } = await import('@/lib/supabase/client');
      const supabase = createPublicClient();

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .eq('kind', kind)
        .eq('status', 'published')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapPostRow(data);
    },

    async listProjects() {
      const { createPublicClient } = await import('@/lib/supabase/client');
      const supabase = createPublicClient();

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        return [];
      }

      return (data as Project[]).map(mapProjectRow);
    },
  };
}

function mapPostRow(row: Record<string, unknown>): Post {
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

function mapProjectRow(row: Record<string, unknown>): Project {
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
