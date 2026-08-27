'use server';

import { randomUUID } from 'node:crypto';

import { requireAdmin } from '@/lib/auth/server';
import { validateImageUpload } from '@/lib/media/validate';
import { createAdminClient } from '@/lib/supabase/admin-client';

export type UploadMediaResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PUBLIC_MEDIA_BUCKET = 'public-media';

/**
 * 图片上传：仅允许 JPEG/PNG/WebP/AVIF，最大 5 MiB。
 * 配置了 Supabase service-role key 时上传到云端 Storage；否则写本地 public/media/（本地开发）。
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

  const supabase = createAdminClient();

  if (supabase) {
    const { error } = await supabase.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .upload(name, buffer, { contentType: file.type, upsert: false });

    if (error) {
      return { ok: false, error: `图片上传失败：${error.message}` };
    }

    const url = supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(name).data.publicUrl;
    return { ok: true, url };
  }

  // 本地开发回退：写 public/media/（与历史行为一致）
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const mediaDir = path.join(process.cwd(), 'public', 'media');

  await mkdir(mediaDir, { recursive: true });
  await writeFile(path.join(mediaDir, name), buffer);

  return { ok: true, url: `/media/${name}` };
}
