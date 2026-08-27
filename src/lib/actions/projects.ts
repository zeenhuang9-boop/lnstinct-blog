'use server';

import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/server';
import { getAdminContentRepository } from '@/lib/content/admin-data-source';
import type { ProjectInput } from '@/lib/content/types';

async function adminRepository() {
  await requireAdmin();
  return getAdminContentRepository();
}

export type SaveProjectResult = { ok: boolean; error?: string; id?: string };

async function parseProjectInput(formData: FormData): Promise<ProjectInput> {
  const tags = String(formData.get('tags') ?? '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    repositoryUrl: String(formData.get('repositoryUrl') ?? '').trim(),
    liveUrl: String(formData.get('liveUrl') ?? '').trim() || undefined,
    tags,
    featured: formData.get('featured') === 'on',
  };
}

export async function createProjectAction(formData: FormData): Promise<SaveProjectResult> {
  const repository = await adminRepository();
  let id: string | null = null;

  try {
    const input = await parseProjectInput(formData);
    const project = await repository.createProject(input);
    id = project.id;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存失败' };
  }

  // redirect 抛出 NEXT_REDIRECT，必须在 try/catch 之外，否则会被当作业务错误吞掉。
  redirect(`/admin/projects/${id}`);
}

export async function updateProjectAction(formData: FormData): Promise<SaveProjectResult> {
  const repository = await adminRepository();
  const id = String(formData.get('id') ?? '');

  try {
    const input = await parseProjectInput(formData);
    await repository.updateProject(id, input);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存失败' };
  }
}

export async function deleteProjectAction(formData: FormData): Promise<SaveProjectResult> {
  const repository = await adminRepository();
  const id = String(formData.get('id') ?? '');

  try {
    await repository.deleteProject(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '删除失败' };
  }
}
