'use server';

import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth/server';
import { getAdminContentRepository } from '@/lib/content/admin-data-source';
import type { PostInput } from '@/lib/content/types';
import { transitionStatus } from '@/domain/content-status';
import type { ContentStatus } from '@/domain/types';

async function adminRepository() {
  await requireAdmin();
  return getAdminContentRepository();
}

export type SavePostResult = { ok: boolean; error?: string; id?: string };

async function parsePostInput(formData: FormData): Promise<PostInput> {
  const contentRaw = formData.get('content');

  let content: PostInput['content'];

  try {
    content = JSON.parse(String(contentRaw ?? '{"type":"doc","content":[]}')) as PostInput['content'];
  } catch {
    throw new Error('正文格式不正确');
  }

  const tags = String(formData.get('tags') ?? '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    kind: formData.get('kind') === 'learning' ? 'learning' : 'article',
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim() || undefined,
    content,
    tags,
  };
}

export async function createPostAction(formData: FormData): Promise<SavePostResult> {
  const repository = await adminRepository();
  let id: string | null = null;

  try {
    const input = await parsePostInput(formData);
    const post = await repository.createPost(input);
    id = post.id;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存失败' };
  }

  // redirect 抛出 NEXT_REDIRECT，必须在 try/catch 之外，否则会被当作业务错误吞掉。
  redirect(`/admin/posts/${id}`);
}

export async function updatePostAction(formData: FormData): Promise<SavePostResult> {
  const repository = await adminRepository();
  const id = String(formData.get('id') ?? '');

  try {
    const input = await parsePostInput(formData);
    await repository.updatePost(id, input);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '保存失败' };
  }
}

/** 状态转换（发布/撤回/移入回收站/恢复），转换规则由领域层状态机保证。 */
export async function changePostStatusAction(formData: FormData): Promise<SavePostResult> {
  const repository = await adminRepository();
  const id = String(formData.get('id') ?? '');
  const event = String(formData.get('event') ?? '') as 'publish' | 'withdraw' | 'trash' | 'restore';

  try {
    const post = await repository.getPostById(id);

    if (!post) {
      return { ok: false, error: '内容不存在' };
    }

    const nextStatus = transitionStatus(post.status, event);
    await repository.setPostStatus(id, nextStatus as ContentStatus);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '状态变更失败' };
  }
}

/** 永久删除：一次只处理一个明确 ID，页面侧有二次确认。 */
export async function deletePostAction(formData: FormData): Promise<SavePostResult> {
  const repository = await adminRepository();
  const id = String(formData.get('id') ?? '');

  try {
    await repository.deletePost(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '删除失败' };
  }
}
