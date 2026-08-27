'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Project } from '@/domain/types';
import { createProjectAction, updateProjectAction, deleteProjectAction } from '@/lib/actions/projects';

export function ProjectForm({ project }: { project: Project | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(project?.repositoryUrl ?? '');
  const [liveUrl, setLiveUrl] = useState(project?.liveUrl ?? '');
  const [tags, setTags] = useState(project?.tags.join('，') ?? '');
  const [featured, setFeatured] = useState(project?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  const isNew = project === null;

  function buildFormData(): FormData {
    const form = new FormData();

    if (project) {
      form.set('id', project.id);
    }

    form.set('title', title);
    form.set('description', description);
    form.set('repositoryUrl', repositoryUrl);
    form.set('liveUrl', liveUrl);
    form.set('tags', tags);
    form.set('featured', featured ? 'on' : 'off');
    return form;
  }

  async function save() {
    setError(null);

    if (isNew) {
      const result = await createProjectAction(buildFormData());

      if (!result.ok) {
        setError(result.error ?? '保存失败');
      }
      return;
    }

    const result = await updateProjectAction(buildFormData());

    if (result.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error ?? '保存失败');
    }
  }

  async function remove() {
    if (!project) {
      return;
    }

    const result = await deleteProjectAction(buildFormData());

    if (result.ok) {
      router.push('/admin/projects');
      router.refresh();
    } else {
      setError(result.error ?? '删除失败');
    }
  }

  const inputClass =
    'w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 dark:border-night-rule dark:bg-night dark:text-cream dark:placeholder:text-cream-soft/60';

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="project-title" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          项目名称
        </label>
        <input id="project-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="project-description" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          简介
        </label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="project-repo" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          源码地址（http/https）
        </label>
        <input id="project-repo" type="url" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/…" className={inputClass} />
      </div>

      <div>
        <label htmlFor="project-live" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          在线预览地址（可选）
        </label>
        <input id="project-live" type="url" value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://…" className={inputClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="project-tags" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
            标签（最多 5 个，用逗号分隔）
          </label>
          <input id="project-tags" type="text" value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-cream-soft">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
              className="h-4 w-4 accent-rust"
            />
            精选项目（首页展示）
          </label>
        </div>
      </div>

      {error ? (
        <p className="border border-rust px-3 py-2 text-sm text-rust dark:border-rust-soft dark:text-rust-soft" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5 dark:border-night-rule">
        <button
          type="button"
          onClick={() => void save()}
          className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
        >
          {isNew ? '创建项目' : '保存'}
        </button>
        {saved ? (
          <span className="text-xs text-ink-soft dark:text-cream-soft" aria-live="polite">
            已保存
          </span>
        ) : null}
        {project ? (
          <div className="ml-auto">
            {confirmDelete ? (
              <span className="inline-flex items-center gap-2 text-xs text-ink-soft dark:text-cream-soft">
                确认删除？
                <button type="button" onClick={() => void remove()} className="border border-rust bg-rust px-3 py-1 text-xs text-paper dark:border-rust-soft dark:bg-rust-soft dark:text-night">
                  确认删除
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="border border-rule px-3 py-1 text-xs text-ink-soft dark:border-night-rule dark:text-cream-soft">
                  取消
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="border border-rust px-3 py-1 text-xs text-rust dark:border-rust-soft dark:text-rust-soft">
                删除项目
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
