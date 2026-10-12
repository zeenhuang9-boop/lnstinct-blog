import type { HerTimelineItem } from './her-types';
import { HerTimelineThumb } from './her-timeline-thumb';

/**
 * 「我们的大事记」：单轴纵向时间线。
 *
 * 结构：左侧 1px 竖线 + 圆点（有日期是锈红实心，待填是灰色），
 * 右侧「缩略图 + 日期 + 标题 + 一句话」。
 *
 * 挂了照片的事件，缩略图直接链到照片墙上那一张（锚点规则见 `her-photo-anchor.ts`，
 * 与照片墙的 id 是同一份规则）；没挂照片就画虚线空位 + 「待补」，
 * 不摆一个会裂的 `<img>`，也不假装有内容。
 */
export function HerTimeline({ items }: { items: readonly HerTimelineItem[] }) {
  return (
    <ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-rule dark:before:bg-night-rule">
      {items.map((item) => (
        <li key={item.id} id={item.id} className="relative scroll-mt-6 pb-9 pl-7 last:pb-0 sm:pl-9">
          <span
            aria-hidden="true"
            className={`absolute top-2 left-0 h-[11px] w-[11px] rounded-full ${
              item.dated ? 'bg-rust dark:bg-rust-soft' : 'bg-rule dark:bg-night-rule'
            }`}
          />

          <div className="flex gap-4">
            {item.photo === null ? (
              <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-sm border border-dashed border-rule bg-paper-soft text-[11px] text-ink-soft/70 sm:h-[54px] sm:w-[72px] dark:border-night-rule dark:bg-night-soft dark:text-cream-soft/70">
                待补
              </span>
            ) : (
              <HerTimelineThumb href={item.photo.href} src={item.photo.src} alt={item.photo.alt} />
            )}

            <div className="min-w-0">
              {item.iso === null ? (
                <span className="text-xs text-ink-soft dark:text-cream-soft">{item.dateLabel}</span>
              ) : (
                <time dateTime={item.iso} className="text-xs text-rust dark:text-rust-soft">
                  {item.dateLabel}
                </time>
              )}
              <h3 className="mt-1 text-base text-ink dark:text-cream">{item.title}</h3>
              {item.note === null ? null : (
                <p className="mt-1 text-sm text-ink-soft dark:text-cream-soft">{item.note}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
