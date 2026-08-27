import { randomUUID } from 'node:crypto';

import type { ContentStatus, Post, PostKind, Project } from '@/domain/types';
import { postInputSchema, projectInputSchema } from '@/domain/input-schemas';
import { slugifyTitle } from '@/lib/slug';
import { filterPublishedPosts } from '@/lib/content/filter';
import type { PostInput, ProjectInput } from '@/lib/content/types';
import { readCollection, writeCollection } from '@/lib/store/files';
import type { ContentRepository, PostQuery } from '@/lib/content/repository';
import type { AdminContentRepository } from '@/lib/content/types';

const POSTS_COLLECTION = 'posts';
const PROJECTS_COLLECTION = 'projects';

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = base;
  let index = 2;

  while (taken.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function validatePostInput(input: PostInput): PostInput {
  return postInputSchema.parse(input);
}

function validateProjectInput(input: ProjectInput): ProjectInput {
  return projectInputSchema.parse(input);
}

/**
 * 兼容旧数据：早期的散文类型 essay 已并入学习记录 learning。
 * 读取时把历史 essay 归一化为 learning，避免旧内容无人认领。
 * 注：PostKind 已移除 'essay'，但磁盘上的旧 JSON 可能仍含该值，故用宽类型比较。
 */
function normalizePost(post: Post): Post {
  return (post as { kind: string }).kind === 'essay' ? { ...post, kind: 'learning' } : post;
}

function readPosts(): Promise<Post[]> {
  return readCollection<Post>(POSTS_COLLECTION).then((posts) => posts.map(normalizePost));
}

/**
 * 本地文件仓储：公开接口与后台管理共用同一份数据，写操作前再次执行 Zod 校验。
 * 单 ID 删除；不做批量删除。
 */
export function createFileContentRepository(): ContentRepository & AdminContentRepository {
  return {
    // ---- 公开读 ----
    async listPublishedPosts(query: PostQuery) {
      const posts = await readPosts();
      return filterPublishedPosts(posts, query);
    },

    async getPublishedPost(slug: string, kind: PostKind) {
      const posts = await readPosts();
      return posts.find((post) => post.slug === slug && post.kind === kind && post.status === 'published') ?? null;
    },

    async listProjects() {
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      return [...projects].sort(
        (a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt),
      );
    },

    // ---- 管理读写 ----
    async listAllPosts() {
      const posts = await readPosts();
      return [...posts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getPostById(id: string) {
      const posts = await readPosts();
      return posts.find((post) => post.id === id) ?? null;
    },

    async createPost(input: PostInput) {
      const valid = validatePostInput(input);
      const posts = await readCollection<Post>(POSTS_COLLECTION);
      const taken = new Set(posts.map((post) => post.slug));
      const timestamp = nowIso();
      const post: Post = {
        id: randomUUID(),
        slug: uniqueSlug(slugifyTitle(valid.title), taken),
        kind: valid.kind,
        title: valid.title,
        summary: valid.summary ?? null,
        content: valid.content,
        tags: valid.tags,
        status: 'draft',
        publishedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await writeCollection(POSTS_COLLECTION, [...posts, post]);
      return post;
    },

    async updatePost(id: string, input: PostInput) {
      const valid = validatePostInput(input);
      const posts = await readCollection<Post>(POSTS_COLLECTION);
      const index = posts.findIndex((post) => post.id === id);

      if (index === -1) {
        throw new Error('Post not found');
      }

      const current = posts[index];
      const updated: Post = {
        ...current,
        slug: uniqueSlug(slugifyTitle(valid.title), new Set(posts.filter((post) => post.id !== id).map((post) => post.slug))),
        title: valid.title,
        summary: valid.summary ?? null,
        content: valid.content,
        tags: valid.tags,
        updatedAt: nowIso(),
      };

      const next = [...posts];
      next[index] = updated;
      await writeCollection(POSTS_COLLECTION, next);
      return updated;
    },

    async setPostStatus(id: string, status: ContentStatus) {
      const posts = await readCollection<Post>(POSTS_COLLECTION);
      const index = posts.findIndex((post) => post.id === id);

      if (index === -1) {
        throw new Error('Post not found');
      }

      const current = posts[index];
      const updated: Post = {
        ...current,
        status,
        publishedAt: status === 'published' ? (current.publishedAt ?? nowIso()) : null,
        updatedAt: nowIso(),
      };

      const next = [...posts];
      next[index] = updated;
      await writeCollection(POSTS_COLLECTION, next);
      return updated;
    },

    async deletePost(id: string) {
      const posts = await readCollection<Post>(POSTS_COLLECTION);
      const next = posts.filter((post) => post.id !== id);

      if (next.length === posts.length) {
        throw new Error('Post not found');
      }

      await writeCollection(POSTS_COLLECTION, next);
    },

    async listAllProjects() {
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      return [...projects].sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt));
    },

    async getProjectById(id: string) {
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      return projects.find((project) => project.id === id) ?? null;
    },

    async createProject(input: ProjectInput) {
      const valid = validateProjectInput(input);
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      const timestamp = nowIso();
      const project: Project = {
        id: randomUUID(),
        slug: uniqueSlug(slugifyTitle(valid.title), new Set(projects.map((project) => project.slug))),
        title: valid.title,
        description: valid.description,
        repositoryUrl: valid.repositoryUrl,
        liveUrl: valid.liveUrl ?? null,
        tags: valid.tags,
        featured: valid.featured ?? false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await writeCollection(PROJECTS_COLLECTION, [...projects, project]);
      return project;
    },

    async updateProject(id: string, input: ProjectInput) {
      const valid = validateProjectInput(input);
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      const index = projects.findIndex((project) => project.id === id);

      if (index === -1) {
        throw new Error('Project not found');
      }

      const current = projects[index];
      const updated: Project = {
        ...current,
        title: valid.title,
        description: valid.description,
        repositoryUrl: valid.repositoryUrl,
        liveUrl: valid.liveUrl ?? null,
        tags: valid.tags,
        featured: valid.featured ?? false,
        updatedAt: nowIso(),
      };

      const next = [...projects];
      next[index] = updated;
      await writeCollection(PROJECTS_COLLECTION, next);
      return updated;
    },

    async deleteProject(id: string) {
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      const next = projects.filter((project) => project.id !== id);

      if (next.length === projects.length) {
        throw new Error('Project not found');
      }

      await writeCollection(PROJECTS_COLLECTION, next);
    },

    async reorderProjects(ids: string[]) {
      const projects = await readCollection<Project>(PROJECTS_COLLECTION);
      const byId = new Map(projects.map((project) => [project.id, project]));
      const ordered = ids.map((id) => byId.get(id)).filter((project): project is Project => Boolean(project));
      const rest = projects.filter((project) => !ids.includes(project.id));

      await writeCollection(PROJECTS_COLLECTION, [...ordered, ...rest]);
    },
  };
}
