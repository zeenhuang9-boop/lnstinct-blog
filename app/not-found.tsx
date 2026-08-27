import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="border border-dashed border-rule px-6 py-16 text-center dark:border-night-rule">
      <p className="font-serif text-5xl font-bold text-rust dark:text-rust-soft">404</p>
      <p className="mt-4 text-sm text-ink-soft dark:text-cream-soft">这一页不存在，或者内容还没有长出来。</p>
      <p className="mt-6">
        <Link
          href="/"
          className="inline-block border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          回到首页
        </Link>
      </p>
    </div>
  );
}
