import type { Project } from '@/domain/types';

function formatDate(project: Project): string {
  return project.createdAt.slice(0, 10);
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-rule dark:divide-night-rule">
      {projects.map((project) => (
        <li key={project.id} className="py-5">
          <article>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-lg font-bold text-ink dark:text-cream">{project.title}</h3>
              {project.featured ? (
                <span className="shrink-0 text-xs text-rust dark:text-rust-soft">精选</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-ink-soft dark:text-cream-soft">
              <time dateTime={project.createdAt}>{formatDate(project)}</time>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">{project.description}</p>
            {project.tags.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-3" aria-label="标签">
                {project.tags.map((tag) => (
                  <li key={tag} className="text-xs text-rust dark:text-rust-soft">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-rust underline-offset-4 hover:underline dark:text-rust-soft"
              >
                源码
              </a>
              {project.liveUrl ? (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-rust underline-offset-4 hover:underline dark:text-rust-soft"
                >
                  在线预览
                </a>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
