import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/auth/server';
import { PostForm } from '@/components/admin/post-form';

export const metadata: Metadata = {
  title: '新内容',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminNewPostPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink dark:text-cream">写一篇新内容</h1>
      <PostForm post={null} />
    </div>
  );
}
