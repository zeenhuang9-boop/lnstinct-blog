import { describe, expect, it } from 'vitest';

import { canResizeHerImage, originalHerImage, resizeHerImage } from '@/components/her/her-image-url';

/**
 * 按需缩放的 URL 规则。
 *
 * 起因（2026-10-12 实测）：照片墙一页 31 个 `<img>`、整页要下 **49.3 MB** 原图，
 * 手机上根本打不开。Supabase 的 render 端点能把 4.23 MB 压到 137 KB。
 *
 * 这些用例锁住三件事：只动 Supabase 地址、缩略图与大图档位不同、不拼出畸形 URL。
 */

const SUPABASE_OBJECT =
  'https://naasedkqzaxnrtyjcxhg.supabase.co/storage/v1/object/public/public-media/abc.jpg';

describe('canResizeHerImage：只认 Supabase 的公开对象地址', () => {
  it('Supabase 公开对象 → 可以缩放', () => {
    expect(canResizeHerImage(SUPABASE_OBJECT)).toBe(true);
  });

  it('本地站内路径 → 不缩放（拼了参数会 404）', () => {
    expect(canResizeHerImage('/media/her/2026-10-12-01.jpg')).toBe(false);
  });

  it('外部图片 → 不缩放', () => {
    expect(canResizeHerImage('https://example.com/a.jpg')).toBe(false);
  });

  it('已经带查询串 → 不缩放（不猜参数语义）', () => {
    expect(canResizeHerImage(`${SUPABASE_OBJECT}?width=100`)).toBe(false);
  });
});

describe('resizeHerImage：按用途给不同档位', () => {
  it('thumb → 480 宽、质量 65，并换成 render 端点', () => {
    const url = resizeHerImage(SUPABASE_OBJECT, 'thumb');

    expect(url).toContain('/storage/v1/render/image/public/');
    expect(url).not.toContain('/storage/v1/object/public/');
    expect(url).toContain('width=480');
    expect(url).toContain('quality=65');
  });

  it('view → 1200 宽、质量 75（查看器要大一些但仍压过）', () => {
    const url = resizeHerImage(SUPABASE_OBJECT, 'view');

    expect(url).toContain('width=1200');
    expect(url).toContain('quality=75');
  });

  it('thumb 与 view 是两个不同地址（不能互相顶替）', () => {
    expect(resizeHerImage(SUPABASE_OBJECT, 'thumb')).not.toBe(resizeHerImage(SUPABASE_OBJECT, 'view'));
  });

  it('文件名与目录原样保留，只改端点和参数', () => {
    const url = resizeHerImage(SUPABASE_OBJECT, 'thumb');

    expect(url.startsWith('https://naasedkqzaxnrtyjcxhg.supabase.co/storage/v1/render/image/public/public-media/')).toBe(
      true,
    );
    expect(url).toContain('abc.jpg?width=');
  });

  it('本地图片原样返回（行为与从前一致）', () => {
    expect(resizeHerImage('/media/her/2026-10-12-01.jpg', 'thumb')).toBe('/media/her/2026-10-12-01.jpg');
  });
});

describe('originalHerImage：变换失败时的回退地址', () => {
  it('render 端点换回 object，并去掉参数', () => {
    const fallback = originalHerImage(resizeHerImage(SUPABASE_OBJECT, 'thumb'));

    expect(fallback).toBe(SUPABASE_OBJECT);
    expect(fallback).not.toContain('?');
    expect(fallback).toContain('/storage/v1/object/public/');
  });

  it('对本来就是原图的地址是幂等的', () => {
    expect(originalHerImage(SUPABASE_OBJECT)).toBe(SUPABASE_OBJECT);
  });

  it('本地图片不受影响', () => {
    expect(originalHerImage('/media/her/2026-10-12-01.jpg')).toBe('/media/her/2026-10-12-01.jpg');
  });
});
