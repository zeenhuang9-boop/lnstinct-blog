import type { Metadata } from 'next';

import { getHerProfile } from '@/lib/content/her-source';
import { todayInChina } from '@/lib/date';
import { formatLongDateParts, toIsoDate } from '@/components/her/her-format';
import { HerLetter } from '@/components/her/her-letter';

// 信上的日期是当天：同样每次请求现算。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '写给你的信',
  description: '写给她的信。',
  robots: { index: false, follow: false },
  alternates: { canonical: '/her/letter' },
};

export default async function HerLetterPage() {
  // 见 app/her/page.tsx 的说明：内容来自数据源，读不到时回退默认内容。
  const profile = await getHerProfile();
  const today = todayInChina();

  return (
    <div className="space-y-10">
      <header className="border-b border-rule pb-6 dark:border-night-rule">
        <h1 className="font-serif text-3xl font-bold text-ink dark:text-cream sm:text-4xl">写给你的信</h1>
        <time
          dateTime={toIsoDate(today)}
          className="mt-3 block text-xs text-ink-soft dark:text-cream-soft"
        >
          {formatLongDateParts(today)}
        </time>
      </header>

      <HerLetter
        salutation={profile.letter.salutation}
        paragraphs={profile.letter.paragraphs}
        quote={profile.letter.quote ?? ''}
        signature={profile.letter.signature ?? ''}
        writtenOn={today}
      />
    </div>
  );
}
