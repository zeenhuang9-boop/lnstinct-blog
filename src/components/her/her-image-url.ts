/**
 * 照片 URL 的「按需缩放」。
 *
 * 为什么需要它（2026-10-12 实测）：照片墙一页要渲染 31 个 `<img>`，如果每个都取原图，
 * 整页要下载 **49.3 MB**（最大单张 4.23 MB）——手机网络下基本打不开、或者只显示一部分。
 * 而这些位置实际只需要几百像素宽。
 *
 * Supabase Storage 提供按需变换端点（`render/image`，实测可用：4.23 MB → 137 KB，降 97%）：
 *   /storage/v1/object/public/<bucket>/<file>
 *   → /storage/v1/render/image/public/<bucket>/<file>?width=600&quality=70
 *
 * 两条边界：
 * - **只改 Supabase 的地址**。本地文件（`/media/her/x.jpg`）与别的外链原样返回，
 *   不会因为多拼了查询参数而 404。
 * - **不动已经带查询串的地址**（保守做法）：宁可少省一点，也不要拼出畸形 URL。
 */

const SUPABASE_OBJECT_MARKER = '/storage/v1/object/public/';
const SUPABASE_RENDER_MARKER = '/storage/v1/render/image/public/';

export type HerImagePreset = 'thumb' | 'view';

/** 缩略图：网格与时间线用。实测 480/q65 平均 117 KB/张（原图平均 1.6 MB） */
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 65;
/** 查看器：点开看的大图。实测 1200/q75 把 3072×4096 的压到约 291 KB */
const VIEW_WIDTH = 1200;
const VIEW_QUALITY = 75;

/** 这个地址能不能走 Supabase 的按需缩放（外部图片、本地文件都不能）。 */
export function canResizeHerImage(src: string): boolean {
  return src.includes(SUPABASE_OBJECT_MARKER) && !src.includes('?');
}

/**
 * 按用途给出「该用哪个地址」：
 * - `thumb`：照片墙网格、时间线缩略图、最近的照片
 * - `view`：点开后的查看器（大图）
 * 不能缩放时返回原地址，行为与从前一致。
 *
 * ⚠️ **变换可能失败**：Supabase 对超大分辨率会直接拒绝——
 * 实测 6144×8192 那张返回 `400 The source image resolution is too large to process`，
 * 而它的**原图是能正常显示的**。所以渲染层必须带 `onError` 回退到原图
 * （见 `her-photo-viewer.tsx` 的 `applyImage`），否则这一张会变成裂图。
 */
export function resizeHerImage(src: string, preset: HerImagePreset): string {
  if (!canResizeHerImage(src)) {
    return src;
  }

  const converted = src.replace(SUPABASE_OBJECT_MARKER, SUPABASE_RENDER_MARKER);

  return preset === 'thumb'
    ? `${converted}?width=${THUMB_WIDTH}&quality=${THUMB_QUALITY}`
    : `${converted}?width=${VIEW_WIDTH}&quality=${VIEW_QUALITY}`;
}

/** 回退用的原图地址：把 render 端点换回 object 端点、去掉变换参数。 */
export function originalHerImage(src: string): string {
  return src.replace(SUPABASE_RENDER_MARKER, SUPABASE_OBJECT_MARKER).replace(/\?.*$/, '');
}
