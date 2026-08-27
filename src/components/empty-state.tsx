export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border border-dashed border-rule px-6 py-12 text-center dark:border-night-rule">
      <p className="font-serif text-lg font-bold text-ink dark:text-cream">{title}</p>
      <p className="mt-2 text-sm text-ink-soft dark:text-cream-soft">{description}</p>
      {action ? (
        <a
          href={action.href}
          className="mt-5 inline-block border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
