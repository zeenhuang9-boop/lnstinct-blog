import type { Metadata } from 'next';

import { getContentDataSource } from '@/lib/content/data-source';
import { ProjectList } from '@/components/project-list';
import { EmptyState } from '@/components/empty-state';

export const metadata: Metadata = {
  title: '项目',
  description: '公开可核验的开源项目实践。',
  alternates: { canonical: '/projects' },
};

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const repository = await getContentDataSource();
  const projects = await repository.listProjects();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink dark:text-cream">项目</h1>
        <p className="mt-2 text-sm text-ink-soft dark:text-cream-soft">
          这里只放来源可核验、可以公开展示的开源项目。
        </p>
      </header>

      <section aria-label="项目列表">
        {projects.length > 0 ? (
          <ProjectList projects={projects} />
        ) : (
          <EmptyState title="还没有项目" description="项目导入后会在这里展示。" />
        )}
      </section>
    </div>
  );
}
