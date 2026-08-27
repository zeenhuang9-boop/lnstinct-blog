import type { Post, PostKind, Project } from '@/domain/types';
import { filterPublishedPosts } from '@/lib/content/filter';

export type PostQuery = {
  kind: PostKind;
  q?: string;
  tag?: string;
};

export interface ContentRepository {
  listPublishedPosts(query: PostQuery): Promise<Post[]>;
  getPublishedPost(slug: string, kind: PostKind): Promise<Post | null>;
  listProjects(): Promise<Project[]>;
}

/**
 * 没有 Supabase 环境时的默认仓储：诚实返回空数据，保证站点可构建、空状态可见。
 * 运行时数据源由 getContentDataSource() 决定（本地文件存储优先，配置了 Supabase 时走云端）。
 */
const emptyContentRepository: ContentRepository = {
  async listPublishedPosts() {
    return [];
  },
  async getPublishedPost() {
    return null;
  },
  async listProjects() {
    return [];
  },
};

let currentRepository: ContentRepository = emptyContentRepository;

export function getContentRepository(): ContentRepository {
  return currentRepository;
}

/** 仅供测试注入内存仓储；生产代码不得调用。 */
export function setContentRepository(repository: ContentRepository): void {
  currentRepository = repository;
}

export function resetContentRepository(): void {
  currentRepository = emptyContentRepository;
}

export function createInMemoryContentRepository(posts: readonly Post[], projects: readonly Project[]): ContentRepository {
  return {
    async listPublishedPosts(query) {
      return filterPublishedPosts(posts, query);
    },
    async getPublishedPost(slug, kind) {
      return (
        posts.find((post) => post.slug === slug && post.kind === kind && post.status === 'published') ?? null
      );
    },
    async listProjects() {
      return [...projects].sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt),
      );
    },
  };
}
