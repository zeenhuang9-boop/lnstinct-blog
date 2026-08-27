import { randomUUID } from 'node:crypto';

import type { ContentStatus } from '@/domain/types';
import { postInputSchema, projectInputSchema } from '@/domain/input-schemas';
import { slugifyTitle } from '@/lib/slug';
import type { PostInput, ProjectInput, AdminContentRepository } from '@/lib/content/types';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { mapPostRow, mapProjectRow } from '@/lib/content/supabase-row-mapper';
import type { SupabaseClient } from '@supabase/supabase-js';

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = base;
  let index = 2;

  while (taken.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Supabase 管理仓储：后台写操作走 service-role key（绕过 RLS，仅服务器端）。
 * 未配置 service-role key 时 createSupabaseAdminContentRepository 返回 null，调用方回退本地文件。
 */
export function createSupabaseAdminContentRepository(): AdminContentRepository | null {
  const supabase = createAdminClient();

  if (!supabase) {
    return null;
  }

  const db: SupabaseClient = supabase;

  async function allSlugs(): Promise<Set<string>> {
    const { data, error } = await db.from('posts').select('slug');
    if (error) {
      throw new Error(`读取 slug 失败：${error.message}`);
    }
    return new Set((data ?? []).map((row) => String(row.slug)));
  }

  return {
    async listAllPosts() {
      const { data, error } = await db
        .from('posts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`读取文章失败：${error.message}`);
      }

      return (data ?? []).map(mapPostRow);
    },

    async getPostById(id: string) {
      const { data, error } = await db.from('posts').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        return null;
      }
      return mapPostRow(data);
    },

    async createPost(input: PostInput) {
      const valid = postInputSchema.parse(input);
      const taken = await allSlugs();
      const timestamp = nowIso();
      const post = {
        id: randomUUID(),
        slug: uniqueSlug(slugifyTitle(valid.title), taken),
        kind: valid.kind,
        title: valid.title,
        summary: valid.summary ?? null,
        content: valid.content,
        tags: valid.tags,
        status: 'draft' as ContentStatus,
        published_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      };

      const { data, error } = await db.from('posts').insert(post).select().single();
      if (error) {
        throw new Error(`创建文章失败：${error.message}`);
      }

      return mapPostRow(data);
    },

    async updatePost(id: string, input: PostInput) {
      const valid = postInputSchema.parse(input);
      const existing = await this.getPostById(id);
      if (!existing) {
        throw new Error('Post not found');
      }

      const taken = await allSlugs();
      taken.delete(existing.slug);

      const { data, error } = await db
        .from('posts')
        .update({
          slug: uniqueSlug(slugifyTitle(valid.title), taken),
          title: valid.title,
          summary: valid.summary ?? null,
          content: valid.content,
          tags: valid.tags,
          updated_at: nowIso(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`更新文章失败：${error.message}`);
      }

      return mapPostRow(data);
    },

    async setPostStatus(id: string, status: ContentStatus) {
      const existing = await this.getPostById(id);
      if (!existing) {
        throw new Error('Post not found');
      }

      const patch: Record<string, unknown> = {
        status,
        updated_at: nowIso(),
      };

      if (status === 'published') {
        patch.published_at = existing.publishedAt ?? nowIso();
      } else if (existing.status === 'published') {
        patch.published_at = null;
      }

      const { data, error } = await db
        .from('posts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`更新状态失败：${error.message}`);
      }

      return mapPostRow(data);
    },

    async deletePost(id: string) {
      const { error } = await db.from('posts').delete().eq('id', id);
      if (error) {
        throw new Error(`删除文章失败：${error.message}`);
      }
    },

    async listAllProjects() {
      const { data, error } = await db
        .from('projects')
        .select('*')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`读取项目失败：${error.message}`);
      }

      return (data ?? []).map(mapProjectRow);
    },

    async getProjectById(id: string) {
      const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        return null;
      }
      return mapProjectRow(data);
    },

    async createProject(input: ProjectInput) {
      const valid = projectInputSchema.parse(input);
      const timestamp = nowIso();
      const project = {
        id: randomUUID(),
        slug: uniqueSlug(slugifyTitle(valid.title), new Set()),
        title: valid.title,
        description: valid.description,
        repository_url: valid.repositoryUrl,
        live_url: valid.liveUrl ?? null,
        tags: valid.tags,
        featured: valid.featured ?? false,
        sort_order: 0,
        created_at: timestamp,
        updated_at: timestamp,
      };

      const { data, error } = await db.from('projects').insert(project).select().single();
      if (error) {
        throw new Error(`创建项目失败：${error.message}`);
      }

      return mapProjectRow(data);
    },

    async updateProject(id: string, input: ProjectInput) {
      const valid = projectInputSchema.parse(input);
      const { data, error } = await db
        .from('projects')
        .update({
          title: valid.title,
          description: valid.description,
          repository_url: valid.repositoryUrl,
          live_url: valid.liveUrl ?? null,
          tags: valid.tags,
          featured: valid.featured ?? false,
          updated_at: nowIso(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`更新项目失败：${error.message}`);
      }

      return mapProjectRow(data);
    },

    async deleteProject(id: string) {
      const { error } = await db.from('projects').delete().eq('id', id);
      if (error) {
        throw new Error(`删除项目失败：${error.message}`);
      }
    },

    async reorderProjects(ids: string[]) {
      // Supabase 端通过 sort_order 实现排序；前台一次提交整个顺序。
      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await db
          .from('projects')
          .update({ sort_order: index + 1 })
          .eq('id', ids[index]);
        if (error) {
          throw new Error(`排序项目失败：${error.message}`);
        }
      }
    },
  };
}
