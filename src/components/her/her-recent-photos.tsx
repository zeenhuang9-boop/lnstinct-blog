import Link from 'next/link';

import type { HerGalleryPhoto } from './her-types';

/**
 * 首页的「最近的照片」：桌面 3 列 / 平板 2 列 / 手机 1 列。
 *
 * 每张缩略图链到照片墙上那一张（`/her/photos#<锚点 id>`），不在首页放放大器 ——
 * 放大只有照片墙有，这里只负责把人送过去。
 * 图注（日期 + 事件名）全部来自事件，页面里不写第二遍文案。
 */
export function HerRecentPhotos({ photos }: { photos: readonly HerGalleryPhoto[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.id}>
          <Link href={`/her/photos#${photo.id}`} className="block">
            <span className="block aspect-[4/3] w-full overflow-hidden rounded-sm border border-rule bg-paper-soft dark:border-night-rule dark:bg-night-soft">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 public/ 图片，按 docs/her-page-roadmap.md §3.5 不走 next/image */}
              <img src={photo.src} alt="" loading="lazy" className="h-full w-full object-cover" />
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
