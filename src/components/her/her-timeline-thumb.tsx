'use client';

import Link from 'next/link';

import { originalHerImage } from './her-image-url';

/**
 * 时间线上的缩略图（一个小方块，链到照片墙那一张）。
 *
 * 为什么单独抽成客户端组件：缩略图走 Supabase 的按需缩放，而**变换会拒绝超大分辨率**
 * （实测 6144×8192 返回 `400 The source image resolution is too large to process`），
 * 那张的原图却能正常显示——没有 `onError` 回退就会变成裂图。
 * 只把这一个 `<img>` 放进客户端包，整条时间线仍然是服务端组件。
 */
export function HerTimelineThumb({ href, src, alt }: { href: string; src: string; alt: string }) {
  return (
    <Link
      href={href}
      className="block h-12 w-16 shrink-0 overflow-hidden rounded-sm border border-rule bg-paper-soft sm:h-[54px] sm:w-[72px] dark:border-night-rule dark:bg-night-soft"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 本地 public/ 与 Supabase Storage 图片，按 docs/her-page-roadmap.md §3.5 不走 next/image */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={(event) => {
          const img = event.currentTarget;

          // 只回退一次，避免原图也失败时无限重试刷请求。
          if (img.dataset.fallback === '1') {
            return;
          }

          img.dataset.fallback = '1';
          img.src = originalHerImage(img.src);
        }}
        className="h-full w-full object-cover"
      />
      <span className="sr-only">到照片墙看这张照片</span>
    </Link>
  );
}
