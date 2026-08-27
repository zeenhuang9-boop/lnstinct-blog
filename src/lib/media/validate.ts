export type MediaValidationResult = { ok: true; extension: string } | { ok: false; error: string };

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

export const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * 图片上传校验（纯函数，便于测试）：仅 JPEG/PNG/WebP/AVIF，最大 5 MiB。
 */
export function validateImageUpload(file: { type: string; size: number }): MediaValidationResult {
  if (!file.type) {
    return { ok: false, error: '无法识别图片类型。' };
  }

  const extension = ALLOWED_MIME[file.type];

  if (!extension) {
    return { ok: false, error: '只支持 JPEG / PNG / WebP / AVIF 格式。' };
  }

  if (file.size === 0) {
    return { ok: false, error: '图片不能为空。' };
  }

  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    return { ok: false, error: '图片超过 5 MiB 限制。' };
  }

  return { ok: true, extension };
}
