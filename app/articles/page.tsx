import type { Metadata } from 'next';

import { PostListPage } from '@/components/post-list-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '文章',
  description: '我的文学天堂',
  alternates: { canonical: '/articles' },
};

export default async function ArticlesPage() {
  return PostListPage({ kind: 'article' });
}
