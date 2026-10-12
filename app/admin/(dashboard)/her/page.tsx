import type { Metadata } from 'next';

import { PHOTO_DIR } from '@/content/her';
import { readHerProfile } from '@/lib/content/her-source';
import { requireAdmin } from '@/lib/auth/server';
import { HerForm } from '@/components/admin/her-form';

export const metadata: Metadata = {
  title: '她',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminHerPage() {
  await requireAdmin();
  const { profile, problem } = await readHerProfile();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-ink dark:text-cream">「她」</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
          这里改的内容会写进 <code className="font-mono text-xs">data/her.json</code>，「我们 / 照片墙 /
          信」三页立刻跟着变。日期留空就是「待填」，不要为了填满写 0。
        </p>
      </header>

      {problem === null || problem.kind === 'missing' ? null : (
        <p
          role="alert"
          className="border border-rust px-3 py-2 text-sm text-rust dark:border-rust-soft dark:text-rust-soft"
        >
          {problem.message}（{problem.file}）直接保存会覆盖这个文件，建议先把它备份或修好。
        </p>
      )}

      <HerForm profile={profile} photoDir={PHOTO_DIR} />
    </div>
  );
}
