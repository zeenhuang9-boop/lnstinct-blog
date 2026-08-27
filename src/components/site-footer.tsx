import { siteConfig } from '@/config/site';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-rule dark:border-night-rule">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-8 text-xs text-ink-soft dark:text-cream-soft">
        <p>
          © {year} {siteConfig.name} · {siteConfig.author}
        </p>
        <p>{siteConfig.description}</p>
        <p>
          <a href="/rss.xml" className="underline-offset-4 hover:underline">
            RSS
          </a>
        </p>
      </div>
    </footer>
  );
}
