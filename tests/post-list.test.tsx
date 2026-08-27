import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Post } from '@/domain/types';
import { PostList } from '@/components/post-list';

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

describe('PostList', () => {
  it('渲染每篇文章的标题链接、摘要与日期', () => {
    render(
      <PostList
        posts={[
          makePost({ id: 'a', slug: 'first', title: '第一篇', summary: '摘要一', publishedAt: '2026-08-01T00:00:00.000Z' }),
          makePost({ id: 'b', slug: 'second', title: '第二篇', summary: null, publishedAt: '2026-08-02T00:00:00.000Z' }),
        ]}
        basePath="/articles"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: '第一篇' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '第一篇' })).toHaveAttribute('href', '/articles/first');
    expect(screen.getByText('摘要一')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02')).toBeInTheDocument();
    expect(screen.queryByText('摘要二')).not.toBeInTheDocument();
  });

  it('不渲染标签链接（已按要求移除标签展示）', () => {
    render(
      <PostList
        posts={[makePost({ slug: 'only', tags: ['数学建模'] })]}
        basePath="/learning"
      />,
    );

    // 标签不应再以链接形式出现。
    expect(screen.queryByRole('link', { name: '数学建模' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /数学建模/ })).not.toBeInTheDocument();
  });

  it('没有文章时渲染诚实空状态', () => {
    render(<PostList posts={[]} basePath="/articles" emptyTitle="还没有文章" emptyDescription="发布后会出现在这里。" />);

    expect(screen.getByText('还没有文章')).toBeInTheDocument();
    // 空状态标题是普通文本而不是链接。
    expect(screen.queryByRole('link', { name: '还没有文章' })).not.toBeInTheDocument();
  });
});
