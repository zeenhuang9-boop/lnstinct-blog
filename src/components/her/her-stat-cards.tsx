import type { HerStatCard } from './her-types';

/**
 * 两张数字卡（服务器组件）。数字由 `buildStatCards` 算好传进来，这里只负责画：
 * 6×34 的锈红竖条 + 大数字 + 单位，下面是说明行，再下面是锈红短句。
 *
 * 未填状态（`muted`）把竖条与数字一起降到一半透明度，一眼能看出「这不是数字」，
 * 而不是拿一个 0 冒充已知的日子。
 */
export function HerStatCards({
  cards,
  footnote,
}: {
  cards: readonly HerStatCard[];
  footnote: string | null;
}) {
  return (
    <div className="rounded border border-rule dark:border-night-rule">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className={
              index === 0
                ? 'px-8 py-8 sm:px-11 sm:py-10'
                : 'border-t border-rule px-8 py-8 sm:border-t-0 sm:border-l dark:border-night-rule sm:px-11 sm:py-10'
            }
          >
            <p className="flex items-end gap-3">
              <span
                aria-hidden="true"
                className={`mb-2 block h-[30px] w-[6px] sm:h-[34px] ${
                  card.muted ? 'bg-rust/45' : 'bg-rust dark:bg-rust-soft'
                }`}
              />
              <span
                className={`font-serif text-[54px] font-bold leading-none sm:text-[66px] ${
                  card.muted ? 'text-ink/55 dark:text-cream/55' : 'text-ink dark:text-cream'
                }`}
              >
                {card.value}
              </span>
              {card.unit === null ? null : (
                <span className="pb-1 text-base text-ink-soft dark:text-cream-soft">{card.unit}</span>
              )}
            </p>
            <p className="mt-3 text-[13px] text-ink-soft dark:text-cream-soft">{card.label}</p>
            <p className="mt-2 text-[13px] text-rust dark:text-rust-soft">{card.note}</p>
          </div>
        ))}
      </div>
      {footnote === null ? null : (
        <p className="border-t border-rule px-8 py-4 text-xs text-ink-soft/80 dark:border-night-rule dark:text-cream-soft/80 sm:px-11">
          {footnote}
        </p>
      )}
    </div>
  );
}
