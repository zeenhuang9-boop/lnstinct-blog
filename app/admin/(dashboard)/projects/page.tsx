import type { Metadata } from 'next';
import Link from 'next/link';

import { createFileContentRepository } from '@/lib/content/file-repository';
import { requireAdmin } from '@/lib/auth/server';
import { SectionHeading } from '@/components/section-heading';

export const metadata: Metadata = {
  title: '项目管理',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  await requireAdmin();
  const repository = createFileContentRepository();
  const projects = await repository.listAllProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>项目管理</SectionHeading>
        <Link
          href="/admin/projects/new"
          className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
        >
          + 新项目
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="border border-dashed border-rule px-4 py-10 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
          还没有项目。
        </p>
      ) : (
        <ul className="divide-y divide-rule dark:divide-night-rule">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="block truncate text-sm font-medium text-ink hover:text-rust dark:text-cream dark:hover:text-rust-soft"
                >
                  {project.title}
                  {project.featured ? <span className="ml-2 text-xs text-rust dark:text-rust-soft">精选</span> : null}
                </Link>
                <p className="mt-0.5 truncate text-xs text-ink-soft dark:text-cream-soft">{project.repositoryUrl}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
