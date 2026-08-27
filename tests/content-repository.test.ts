import { afterEach, describe, expect, it } from 'vitest';

import type { Post, Project } from '@/domain/types';
import {
  createInMemoryContentRepository,
  resetContentRepository,
  getContentRepository,
  setContentRepository,
} from '@/lib/content/repository';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    slug: 'hello-world',
    kind: 'article',
    title: '你好世界',
    summary: '第一篇正文',
    content: { type: 'doc', content: [] },
    tags: ['随笔'],
    status: 'published',
    publishedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    slug: 'demo',
    title: '演示项目',
    description: '一个演示项目',
    repositoryUrl: 'https://github.com/example/demo',
    liveUrl: null,
    tags: ['Next.js'],
    featured: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  resetContentRepository();
});

describe('默认仓储', () => {
  it('没有 Supabase 环境时返回空数据', async () => {
    const repository = getContentRepository();

    await expect(repository.listPublishedPosts({ kind: 'article' })).resolves.toEqual([]);
    await expect(repository.listProjects()).resolves.toEqual([]);
  });
});

describe('内存仓储', () => {
  it('listPublishedPosts 委托过滤逻辑并隔离 kind', async () => {
    const article = makePost({ id: 'a', slug: 'a' });
    const learning = makePost({ id: 'e', slug: 'e', kind: 'learning' });
    const repository = createInMemoryContentRepository([article, learning], []);

    await expect(repository.listPublishedPosts({ kind: 'article' })).resolves.toHaveLength(1);
    await expect(repository.listPublishedPosts({ kind: 'learning' })).resolves.toHaveLength(1);
  });

  it('getPublishedPost 按 slug 与 kind 精确查找', async () => {
    const article = makePost({ id: 'a', slug: 'same-slug' });
    const learning = makePost({ id: 'e', slug: 'same-slug', kind: 'learning' });
    const repository = createInMemoryContentRepository([article, learning], []);

    await expect(repository.getPublishedPost('same-slug', 'learning')).resolves.toMatchObject({ id: 'e' });
    await expect(repository.getPublishedPost('missing', 'article')).resolves.toBeNull();
  });

  it('listProjects 默认按 featured 优先、创建时间倒序', async () => {
    const normalOld = makeProject({ id: 'a', slug: 'a', createdAt: '2026-07-01T00:00:00.000Z' });
    const featured = makeProject({ id: 'b', slug: 'b', featured: true });
    const repository = createInMemoryContentRepository([], [normalOld, featured]);

    const projects = await repository.listProjects();

    expect(projects.map((project) => project.id)).toEqual(['b', 'a']);
  });
});

describe('仓储注入', () => {
  it('setContentRepository 注入后 getContentRepository 返回同一实例', () => {
    const repository = createInMemoryContentRepository([], []);

    setContentRepository(repository);

    expect(getContentRepository()).toBe(repository);
  });
});
