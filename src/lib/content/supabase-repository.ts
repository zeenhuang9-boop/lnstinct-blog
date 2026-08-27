import type { ContentRepository, PostQuery } from '@/lib/content/repository';
import { filterPublishedPosts } from '@/lib/content/filter';
import type { Post, PostKind } from '@/domain/types';
import { mapPostRow, mapProjectRow } from '@/lib/content/supabase-row-mapper';

/**
 * Supabase 仓储的公开读实现。
 * 只有 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 都配置时才被创建；
 * 匿名读仅能读 published（RLS），后台写操作走 service-role key（见 supabase-admin-repository）。
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
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        return [];
      }

      return (data ?? []).map(mapProjectRow);
    },
  };
}
