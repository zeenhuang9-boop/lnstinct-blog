import type { Metadata } from 'next';

import { getHerProfile } from '@/lib/content/her-source';
import { EmptyState } from '@/components/empty-state';
import { buildGalleryGroups, buildPhotoSummary } from '@/components/her/her-data';
import { HerPhotoViewer } from '@/components/her/her-photo-viewer';

// 与 /her 一样每次请求现算：分组与计数跟着 data/her.json 走，不吃构建期的缓存。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '照片墙',
  description: '按时间分组的全部照片，点开在原位放大。',
  robots: { index: false, follow: false },
  alternates: { canonical: '/her/photos' },
};

export default async function HerPhotosPage() {
  // 见 app/her/page.tsx 的说明：内容来自数据源，读不到时回退默认内容。
  const profile = await getHerProfile();
  const groups = buildGalleryGroups(profile);
  const { groupCount } = buildPhotoSummary(profile);

  // 计数一律按「实际会渲染出来的照片数」算，而不是 `profile.photos.length`：
  // 两者正常情况下相等，但一旦有照片没进任何分组，按数据长度报数就会出现
  // 「写着共 3 张、只看得见 2 张」这种对不上的数字。
  const renderedPhotoCount = groups.reduce((total, group) => total + group.photos.length, 0);

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-serif text-3xl font-bold text-ink dark:text-cream sm:text-4xl">照片墙</h1>
          {renderedPhotoCount === 0 ? null : (
            <p className="text-xs text-ink-soft dark:text-cream-soft">
              共 {renderedPhotoCount} 张{groupCount === 0 ? '' : ` · ${groupCount} 个事件`}
            </p>
          )}
        </div>
        <p className="mt-3 text-sm text-ink-soft dark:text-cream-soft">
          按时间分组。每组就是大事记上的一个事件，点标题回时间线。
        </p>
      </header>

      {renderedPhotoCount === 0 ? (
        <EmptyState
          title="还没有照片"
          description="照片放进来之后会按事件分组显示在这里；还没配照片的事件留着虚线空位。"
        />
      ) : (
        <HerPhotoViewer groups={groups} />
      )}
    </div>
  );
}
