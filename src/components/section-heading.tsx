export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-5 font-serif text-2xl font-bold text-ink dark:text-cream">
      {children}
    </h2>
  );
}
