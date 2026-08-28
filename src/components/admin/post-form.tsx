'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Post, TiptapDocument } from '@/domain/types';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { RichText } from '@/components/rich-text';
import {
  createPostAction,
  updatePostAction,
  changePostStatusAction,
  deletePostAction,
  type SavePostResult,
} from '@/lib/actions/posts';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const statusLabels: Record<Post['status'], string> = {
  draft: '草稿',
  published: '已发布',
  trashed: '回收站',
};

export function PostForm({ post }: { post: Post | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<Post['kind']>(post?.kind ?? 'article');
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [content, setContent] = useState<TiptapDocument>(post?.content ?? { type: 'doc', content: [] });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<SavePostResult>>(Promise.resolve({ ok: true }));
  const saveVersionRef = useRef(0);
  const statusInFlightRef = useRef(false);

  const isNew = post === null;
  const hasUnsaved = saveState === 'saving' || saveState === 'error';

  function buildFormData(extra?: Record<string, string>): FormData {
    const form = new FormData();

    if (post) {
      form.set('id', post.id);
    }

    form.set('kind', kind);
    form.set('title', title);
    form.set('summary', summary);
    form.set('tags', '');
    form.set('content', JSON.stringify(content));
    Object.entries(extra ?? {}).forEach(([key, value]) => form.set(key, value));
    return form;
  }

  function enqueueOperation(operation: () => Promise<SavePostResult>): Promise<SavePostResult> {
    const execute = () => operation();
    const queued = saveQueueRef.current
      .then(execute, execute)
      .catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : '保存失败' }));

    saveQueueRef.current = queued;
    return queued;
  }

  function enqueueUpdate(formData: FormData): Promise<SavePostResult> {
    const version = saveVersionRef.current + 1;
    saveVersionRef.current = version;
    setSaveState('saving');

    const queued = enqueueOperation(() => updatePostAction(formData));

    return queued.then((result) => {
      if (version === saveVersionRef.current) {
        setSaveState(result.ok ? 'saved' : 'error');
      }
      return result;
    });
  }

  // 自动保存：2 秒防抖；失败时保留本地正文并提示，不丢失内容。
  useEffect(() => {
    if (isNew || title === '') {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      await enqueueUpdate(buildFormData());
    }, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, title, summary, content, isNew]);

  async function saveDraft() {
    if (title === '') {
      setActionError('标题不能为空。');
      return;
    }

    if (isNew) {
      const result = await createPostAction(buildFormData());

      if (result.ok) {
        router.refresh();
      } else {
        setActionError(result.error ?? '保存失败');
      }
      return;
    }

    const result = await enqueueUpdate(buildFormData());
    setActionError(result.ok ? null : (result.error ?? '保存失败'));
  }

  async function runStatus(event: 'publish' | 'withdraw' | 'trash' | 'restore') {
    if (!post || statusInFlightRef.current) {
      return;
    }

    if (event === 'publish' && title === '') {
      setActionError('标题不能为空，无法发布。');
      return;
    }

    statusInFlightRef.current = true;

    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const saveResult = await enqueueUpdate(buildFormData());

      if (!saveResult.ok) {
        setActionError(saveResult.error ?? '保存失败');
        return;
      }

      const statusPromise = enqueueOperation(() => changePostStatusAction(buildFormData({ event })));
      const result = await statusPromise;

      if (result.ok) {
        setActionError(null);
        const trailingOperation = saveQueueRef.current;
        if (trailingOperation !== statusPromise) {
          await trailingOperation;
        }
        router.refresh();
      } else {
        setActionError(result.error ?? '操作失败');
      }
    } finally {
      statusInFlightRef.current = false;
    }
  }

  async function runDelete() {
    if (!post) {
      return;
    }

    const result = await deletePostAction(buildFormData());

    if (result.ok) {
      router.push('/admin/posts');
      router.refresh();
    } else {
      setActionError(result.error ?? '删除失败');
    }
  }

  const inputClass =
    'w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 dark:border-night-rule dark:bg-night dark:text-cream dark:placeholder:text-cream-soft/60';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft dark:text-cream-soft">
          {post ? statusLabels[post.status] : '新内容'}
        </p>
        <p aria-live="polite" className="text-xs text-ink-soft dark:text-cream-soft">
          {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : saveState === 'error' ? '保存失败' : '等待编辑'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            id="post-kind-label"
            htmlFor="post-kind"
            className="mb-1 block text-xs text-ink-soft dark:text-cream-soft"
          >
            类型
          </label>
          <select
            id="post-kind"
            aria-labelledby="post-kind-label"
            value={kind}
            onChange={(event) => setKind(event.target.value as Post['kind'])}
            className={inputClass}
          >
            <option value="article">文章</option>
            <option value="learning">学习记录</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="post-title" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          标题
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="给这篇文章起个名字"
          className={`${inputClass} font-serif text-lg font-bold`}
        />
      </div>

      <div>
        <label htmlFor="post-summary" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          摘要（可选）
        </label>
        <textarea
          id="post-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={2}
          placeholder="一句话说明这篇文章的内容"
          className={inputClass}
        />
      </div>

      <div>
        <span className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">正文</span>
        <RichTextEditor initialContent={content} onChange={setContent} />
      </div>

      {actionError ? (
        <p className="border border-rust px-3 py-2 text-sm text-rust dark:border-rust-soft dark:text-rust-soft" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5 dark:border-night-rule">
        <button
          type="button"
          onClick={() => void saveDraft()}
          className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          {isNew ? '创建草稿' : '保存草稿'}
        </button>

        {post ? (
          <>
            {post.status === 'draft' ? (
              <button
                type="button"
                onClick={() => void runStatus('publish')}
                className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
              >
                发布
              </button>
            ) : null}
            {post.status === 'published' ? (
              <button
                type="button"
                onClick={() => void runStatus('withdraw')}
                className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
              >
                撤回
              </button>
            ) : null}
            {post.status === 'trashed' ? (
              <button
                type="button"
                onClick={() => void runStatus('restore')}
                className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
              >
                恢复
              </button>
            ) : null}
            {post.status !== 'trashed' ? (
              <button
                type="button"
                onClick={() => void runStatus('trash')}
                className="border border-rule px-4 py-2 text-sm text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft"
              >
                移入回收站
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPreviewOpen((value) => !value)}
              className="border border-rule px-4 py-2 text-sm text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft"
            >
              {previewOpen ? '关闭预览' : '预览'}
            </button>
            <div className="ml-auto">
              {confirmDelete ? (
                <span className="inline-flex items-center gap-2 text-xs text-ink-soft dark:text-cream-soft">
                  确认永久删除？
                  <button
                    type="button"
                    onClick={() => void runDelete()}
                    className="border border-rust bg-rust px-3 py-1 text-xs text-paper dark:border-rust-soft dark:bg-rust-soft dark:text-night"
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="border border-rule px-3 py-1 text-xs text-ink-soft dark:border-night-rule dark:text-cream-soft"
                  >
                    取消
                  </button>
                </span>
              ) : post.status === 'trashed' ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="border border-rust px-3 py-1 text-xs text-rust dark:border-rust-soft dark:text-rust-soft"
                >
                  永久删除
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {previewOpen ? (
        <section aria-label="预览" className="border border-dashed border-rule p-6 dark:border-night-rule">
          <h2 className="mb-4 font-serif text-2xl font-bold text-ink dark:text-cream">{title || '（未命名）'}</h2>
          {summary ? <p className="mb-4 text-sm text-ink-soft dark:text-cream-soft">{summary}</p> : null}
          <RichText doc={content} />
        </section>
      ) : null}

      {hasUnsaved && !isNew ? (
        <p className="text-xs text-rust dark:text-rust-soft" role="status">
          正在自动保存，请勿关闭页面。
        </p>
      ) : null}
    </div>
  );
}
