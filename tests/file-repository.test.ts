import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createFileContentRepository } from '@/lib/content/file-repository';
import { clearCollectionCache } from '@/lib/store/files';
import type { PostInput, ProjectInput } from '@/lib/content/types';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'lnstinct-test-'));
  process.env.LNSTINCT_DATA_DIR = tempDir;
  clearCollectionCache();
});

afterEach(async () => {
  delete process.env.LNSTINCT_DATA_DIR;
  clearCollectionCache();
  await rm(tempDir, { recursive: true, force: true });
});

function makePostInput(overrides: Partial<PostInput> = {}): PostInput {
  return {
    kind: 'article',
    title: '测试文章',
    summary: '摘要',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文' }] }] },
    tags: ['测试'],
    ...overrides,
  };
}

describe('createFileContentRepository', () => {
  it('createPost 生成草稿并自动生成 slug', async () => {
    const repository = createFileContentRepository();
    const post = await repository.createPost(makePostInput());

    expect(post.status).toBe('draft');
    expect(post.publishedAt).toBeNull();
    expect(post.slug).toBe('测试文章');

    const listed = await repository.listAllPosts();
    expect(listed).toHaveLength(1);
  });

  it('重复标题时生成唯一 slug', async () => {
    const repository = createFileContentRepository();
    const first = await repository.createPost(makePostInput());
    const second = await repository.createPost(makePostInput());

    expect(second.slug).not.toBe(first.slug);
  });

  it('updatePost 更新内容并保持 id 不变', async () => {
    const repository = createFileContentRepository();
    const post = await repository.createPost(makePostInput());
    const updated = await repository.updatePost(post.id, { ...makePostInput(), title: '新标题' });

    expect(updated.id).toBe(post.id);
    expect(updated.title).toBe('新标题');

    const fetched = await repository.getPostById(post.id);
    expect(fetched?.title).toBe('新标题');
  });

  it('setPostStatus 发布时写入 publishedAt，撤回时清空', async () => {
    const repository = createFileContentRepository();
    const post = await repository.createPost(makePostInput());
    const published = await repository.setPostStatus(post.id, 'published');

    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();

    const withdrawn = await repository.setPostStatus(post.id, 'draft');
    expect(withdrawn.status).toBe('draft');
    expect(withdrawn.publishedAt).toBeNull();
  });

  it('deletePost 只删除指定 id', async () => {
    const repository = createFileContentRepository();
    const first = await repository.createPost(makePostInput({ title: '第一篇' }));
    const second = await repository.createPost(makePostInput({ title: '第二篇' }));

    await repository.deletePost(first.id);

    const remaining = await repository.listAllPosts();
    expect(remaining.map((post) => post.id)).toEqual([second.id]);
  });

  it('deletePost 不存在的 id 抛错', async () => {
    const repository = createFileContentRepository();
    await expect(repository.deletePost('missing')).rejects.toThrow('Post not found');
  });

  it('公开列表只返回 published', async () => {
    const repository = createFileContentRepository();
    await repository.createPost(makePostInput({ title: '草稿一篇' }));

    const toPublish = await repository.createPost(makePostInput({ title: '要发布的' }));
    await repository.setPostStatus(toPublish.id, 'published');

    const publicPosts = await repository.listPublishedPosts({ kind: 'article' });
    expect(publicPosts.map((item) => item.title)).toEqual(['要发布的']);
  });

  it('项目：createProject 与读取', async () => {
    const repository = createFileContentRepository();
    const input: ProjectInput = {
      title: '演示项目',
      description: '描述',
      repositoryUrl: 'https://github.com/example/demo',
      tags: ['Web'],
    };
    const project = await repository.createProject(input);

    expect(project.slug).toBe('演示项目');
    expect(project.featured).toBe(false);

    const fetched = await repository.getProjectById(project.id);
    expect(fetched?.title).toBe('演示项目');
  });

  it('项目：非法 URL 被 Zod 拒绝', async () => {
    const repository = createFileContentRepository();

    await expect(
      repository.createProject({
        title: '坏项目',
        description: '描述',
        repositoryUrl: 'javascript:alert(1)',
        tags: [],
      }),
    ).rejects.toThrow();
  });

  it('内容：空标题被 Zod 拒绝', async () => {
    const repository = createFileContentRepository();

    await expect(repository.createPost(makePostInput({ title: '   ' }))).rejects.toThrow();
  });
});
