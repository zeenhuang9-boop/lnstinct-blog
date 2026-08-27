import { describe, expect, it } from 'vitest';

import type { Post } from '@/domain/types';
import { filterPublishedPosts } from '@/lib/content/filter';

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

describe('filterPublishedPosts', () => {
  it('只保留已发布内容并按发布时间倒序', () => {
    const older = makePost({ id: 'a', slug: 'a', publishedAt: '2026-07-01T00:00:00.000Z' });
    const newer = makePost({ id: 'b', slug: 'b', publishedAt: '2026-08-02T00:00:00.000Z' });
    const draft = makePost({ id: 'c', slug: 'c', status: 'draft' });

    const result = filterPublishedPosts([draft, older, newer], { kind: 'article' });

    expect(result.map((post) => post.id)).toEqual(['b', 'a']);
  });

  it('按 kind 隔离文章与学习记录', () => {
    const article = makePost({ id: 'a', slug: 'a' });
    const learning = makePost({ id: 'e', slug: 'e', kind: 'learning', title: '每日学习' });

    expect(filterPublishedPosts([article, learning], { kind: 'article' }).map((p) => p.id)).toEqual(['a']);
    expect(filterPublishedPosts([article, learning], { kind: 'learning' }).map((p) => p.id)).toEqual(['e']);
  });

  it('q 同时匹配标题与摘要（不区分大小写）', () => {
    const matchedTitle = makePost({ id: 'a', slug: 'a', title: 'Vitest 实践' });
    const matchedSummary = makePost({ id: 'b', slug: 'b', title: '其他', summary: '关于 VITEST 的笔记' });
    const notMatched = makePost({ id: 'c', slug: 'c', title: '别的内容' });

    const result = filterPublishedPosts([matchedTitle, matchedSummary, notMatched], {
      kind: 'article',
      q: 'vitest',
    });

    expect(result.map((post) => post.id)).toEqual(['a', 'b']);
  });

  it('tag 精确匹配标签', () => {
    const tagged = makePost({ id: 'a', slug: 'a', tags: ['数学建模', '笔记'] });
    const other = makePost({ id: 'b', slug: 'b', tags: ['随笔'] });

    const result = filterPublishedPosts([tagged, other], { kind: 'article', tag: '数学建模' });

    expect(result.map((post) => post.id)).toEqual(['a']);
  });
});
