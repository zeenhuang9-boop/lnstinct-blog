import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/auth/server';
import { ProjectForm } from '@/components/admin/project-form';

export const metadata: Metadata = {
  title: '新项目',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminNewProjectPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink dark:text-cream">新建项目</h1>
      <ProjectForm project={null} />
    </div>
  );
}
