'use server';

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { requireAdmin } from '@/lib/auth/server';
import { validateImageUpload } from '@/lib/media/validate';

export type UploadMediaResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const MEDIA_DIR = path.join(process.cwd(), 'public', 'media');

/**
 * 图片上传：仅允许 JPEG/PNG/WebP/AVIF，最大 5 MiB；
 * 文件名使用随机 UUID，避免路径注入与覆盖。
 */
export async function uploadMediaAction(formData: FormData): Promise<UploadMediaResult> {
  await requireAdmin();

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return { ok: false, error: '没有收到图片文件。' };
  }

  const validation = validateImageUpload(file);

  if (!validation.ok) {
    return validation;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}${validation.extension}`;

  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(path.join(MEDIA_DIR, name), buffer);

  return { ok: true, url: `/media/${name}` };
}

