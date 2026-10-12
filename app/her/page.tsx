import type { Metadata } from 'next';
import Link from 'next/link';

import { getHerProfile } from '@/lib/content/her-source';
import { todayInChina } from '@/lib/date';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';
import { buildRecentPhotos, buildStatCards, buildTimelineItems } from '@/components/her/her-data';
import { HerRecentPhotos } from '@/components/her/her-recent-photos';
import { HerStatCards } from '@/components/her/her-stat-cards';
import { HerTimeline } from '@/components/her/her-timeline';

// 倒计时必须每次请求现算：被静态化的话，天数会永远停在构建那一天。
// 同时也是「后台保存完刷新即见」的前提——内容每次请求都重新读 data/her.json。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '她',
  description: '写给她的日子、照片和一封信。',
  robots: { index: false, follow: false },
  alternates: { canonical: '/her' },
};

/** 首页只露最近三张，其余去照片墙。 */
const RECENT_PHOTO_COUNT = 3;

export default async function HerPage() {
  // 内容来自 `data/her.json`（后台上传/编辑写入的那份）；
  // 文件不存在或坏掉时 `getHerProfile()` 回退到 `src/content/her.ts` 的默认内容，永不返回 null。
  const profile = await getHerProfile();
  const today = todayInChina();

  const { cards, footnote } = buildStatCards(today, profile);
  const timeline = buildTimelineItems(profile);
  const recentPhotos = buildRecentPhotos(RECENT_PHOTO_COUNT, profile);
  const photoCount = profile.photos.length;

  return (
    <div className="space-y-14">
      <header>
        <h1 className="font-serif text-4xl font-bold leading-tight text-ink dark:text-cream sm:text-5xl">
          写给 {profile.displayName}
          <span className="ml-3 text-lg font-normal text-ink-soft/70 dark:text-cream-soft/70">
            <span aria-hidden="true" className="mr-2 text-2xl text-rust/75 dark:text-rust-soft/75">
              ·
            </span>
            {profile.heroYear}
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft dark:text-cream-soft">
          {profile.tagline}
        </p>
      </header>

      <HerStatCards cards={cards} footnote={footnote} />

      <section aria-labelledby="her-timeline-title">
        <SectionHeading id="her-timeline-title">我们的大事记</SectionHeading>
        {timeline.length === 0 ? (
          <EmptyState
            title="还没有写下任何事件"
            description="把记得的那天记下来，它会成为时间线上的第一个节点。"
          />
        ) : (
          <HerTimeline items={timeline} />
        )}
      </section>

      <section aria-labelledby="her-recent-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <SectionHeading id="her-recent-title">最近的照片</SectionHeading>
          {photoCount === 0 ? null : (
            <Link
              href="/her/photos"
              className="text-xs text-rust underline-offset-4 hover:underline dark:text-rust-soft"
            >
              全部 {photoCount} 张 →
            </Link>
          )}
        </div>
        {recentPhotos.length === 0 ? (
          <EmptyState title="还没有照片" description="照片放进来之后，这里会先显示最近的三张。" />
        ) : (
          <HerRecentPhotos photos={recentPhotos} />
        )}
      </section>

      <div className="border-y border-rule dark:border-night-rule">
        <section aria-labelledby="her-photos-entry" className="border-b border-rule py-6 dark:border-night-rule">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="her-photos-entry" className="font-serif text-lg font-bold text-ink dark:text-cream">
              照片墙
            </h2>
            <Link
              href="/her/photos"
              className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft"
            >
              照片墙 →
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-soft dark:text-cream-soft">
            按时间分组的全部照片，点开可以放大看。
          </p>
        </section>

        <section aria-labelledby="her-letter-entry" className="py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="her-letter-entry" className="font-serif text-lg font-bold text-ink dark:text-cream">
              写给你的信
            </h2>
            <Link
              href="/her/letter"
              className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft"
            >
              信 →
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-soft dark:text-cream-soft">信单独一页，通篇只有文字。</p>
        </section>
      </div>
    </div>
  );
}
