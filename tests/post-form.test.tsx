import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Post } from '@/domain/types';
import { PostForm } from '@/components/admin/post-form';

const mocks = vi.hoisted(() => ({
  updatePostAction: vi.fn(),
  changePostStatusAction: vi.fn(),
  createPostAction: vi.fn(),
  deletePostAction: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));

vi.mock('@/lib/actions/posts', () => ({
  updatePostAction: mocks.updatePostAction,
  changePostStatusAction: mocks.changePostStatusAction,
  createPostAction: mocks.createPostAction,
  deletePostAction: mocks.deletePostAction,
}));

vi.mock('@/components/admin/rich-text-editor', () => ({
  RichTextEditor: () => <div data-testid="editor" />,
}));

vi.mock('@/components/rich-text', () => ({
  RichText: () => <div data-testid="preview" />,
}));

const post: Post = {
  id: 'post-1',
  slug: 'post-1',
  kind: 'article',
  title: '并发保存测试',
  summary: null,
  content: { type: 'doc', content: [] },
  tags: [],
  status: 'draft',
  publishedAt: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('PostForm 保存顺序', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.updatePostAction.mockReset();
    mocks.changePostStatusAction.mockReset().mockResolvedValue({ ok: true });
    mocks.createPostAction.mockReset();
    mocks.deletePostAction.mockReset();
    mocks.refresh.mockReset();
    mocks.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('等待旧自动保存完成后再保存最新类型并发布', async () => {
    const firstSave = deferred<{ ok: boolean }>();
    const publish = deferred<{ ok: boolean }>();
    mocks.updatePostAction
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue({ ok: true });
    mocks.changePostStatusAction.mockImplementationOnce(() => publish.promise);

    render(<PostForm post={post} />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(1);
    expect((mocks.updatePostAction.mock.calls[0][0] as FormData).get('kind')).toBe('article');

    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'learning' } });
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.updatePostAction).toHaveBeenCalledTimes(1);
    expect(mocks.changePostStatusAction).not.toHaveBeenCalled();

    await act(async () => {
      firstSave.resolve({ ok: true });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);
    expect((mocks.updatePostAction.mock.calls[1][0] as FormData).get('kind')).toBe('learning');
    expect(mocks.changePostStatusAction).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '发布等待期间的新正文' } });
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mocks.updatePostAction).toHaveBeenCalledTimes(2);

    await act(async () => {
      publish.resolve({ ok: true });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.updatePostAction).toHaveBeenCalledTimes(3);
    expect((mocks.updatePostAction.mock.calls[2][0] as FormData).get('title')).toBe('发布等待期间的新正文');
  });
});
