import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createFileContentRepository } from '@/lib/content/file-repository';
import { requireAdmin } from '@/lib/auth/server';
import { PostForm } from '@/components/admin/post-form';

export const metadata: Metadata = {
  title: '编辑内容',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Params = { id: string };

export default async function AdminEditPostPage({ params }: { params: Promise<Params> }) {
  await requireAdmin();
  const { id } = await params;
  const repository = createFileContentRepository();
  const post = await repository.getPostById(id);

  if (!post) {
    notFound();
  }

  return (
    <div>
      <nav aria-label="面包屑" className="mb-4">
        <Link href="/admin/posts" className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft">
          ← 返回内容管理
        </Link>
      </nav>
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink dark:text-cream">编辑内容</h1>
      <PostForm post={post} />
    </div>
  );
}
