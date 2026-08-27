import type { Metadata } from 'next';

import { PostListPage } from '@/components/post-list-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '学习记录',
  description: '专业学习文章的集合：把每天的学习内容写成文章，记录成长的每一步。',
  alternates: { canonical: '/learning' },
};

export default async function LearningPage() {
  return PostListPage({ kind: 'learning' });
}
