'use client';

import Link from 'next/link';

import { originalHerImage } from './her-image-url';
import type { HerGalleryPhoto } from './her-types';

/**
 * 首页的「最近的照片」：桌面 3 列 / 平板 2 列 / 手机 1 列。
 *
 * 每张缩略图链到照片墙上那一张（`/her/photos#<锚点 id>`），不在首页放放大器 ——
 * 放大只有照片墙有，这里只负责把人送过去。
 * 图注（日期 + 事件名）全部来自事件，页面里不写第二遍文案。
 *
 * 为什么是客户端组件：缩略图走 Supabase 的按需缩放，而**变换会拒绝超大分辨率**
 * （实测 6144×8192 返回 400），那张的原图却能正常显示。要给这种图一次回退机会，
 * 就得有 `onError` —— 服务端组件里挂不上。代价只有一个很小的叶子组件。
 */
export function HerRecentPhotos({ photos }: { photos: readonly HerGalleryPhoto[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.id}>
          <Link href={`/her/photos#${photo.id}`} className="block">
            <span className="block aspect-[4/3] w-full overflow-hidden rounded-sm border border-rule bg-paper-soft dark:border-night-rule dark:bg-night-soft">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 public/ 与 Supabase Storage 图片，按 docs/her-page-roadmap.md §3.5 不走 next/image */}
              <img
                src={photo.thumbSrc}
                alt=""
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
            </span>
            {photo.day === null ? null : (
              <span className="mt-2 block text-xs text-rust dark:text-rust-soft">{photo.day}</span>
            )}
            <span className="block text-xs text-ink-soft dark:text-cream-soft">{photo.eventTitle}</span>
            <span className="sr-only">到照片墙看这张照片</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
