import { EmptyState } from '@/components/empty-state';

import { formatYearMonth, toIsoDate } from './her-format';

/**
 * 「写给你的信」：整页只有文字，正文复用站点现成的 `.rich-text` 排版
 * （衬线 17px / 行高 1.9、引用块左侧 3px 锈红），不另写一套行高。
 *
 * 段落、引用、落款都来自内容文件；正文为空时不留空白页，显示一句「这封信还没写完」。
 */
export function HerLetter({
  salutation,
  paragraphs,
  quote,
  signature,
  writtenOn,
}: {
  salutation: string;
  paragraphs: readonly string[];
  quote: string;
  signature: string;
  writtenOn: { readonly year: number; readonly month: number; readonly day: number };
}) {
  const hasBody = paragraphs.length > 0 || quote.length > 0;

  if (!hasBody) {
    return <EmptyState title="这封信还没写完" description="信的内容留了空位，写好后会显示在这一页。" />;
  }

  return (
    <article>
      <div className="rich-text">
        {salutation.length > 0 ? <p>{salutation}</p> : null}
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {quote.length > 0 ? <blockquote>{quote}</blockquote> : null}
      </div>

      {signature.length > 0 ? (
        <div className="mt-16 text-right">
          <p className="font-serif text-base text-ink dark:text-cream">{signature}</p>
          <time
            dateTime={toIsoDate(writtenOn)}
            className="mt-1 block text-xs text-ink-soft dark:text-cream-soft"
          >
            {formatYearMonth(writtenOn)}
          </time>
        </div>
      ) : null}
    </article>
  );
}
