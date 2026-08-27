import type { Metadata, Viewport } from 'next';

import { siteConfig } from '@/config/site';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} · ${siteConfig.author}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} · ${siteConfig.author}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    type: 'website',
    url: siteConfig.url,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf3e6' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1913' },
  ],
};

// 默认始终为暖色书本纸页（浅色），不跟随系统深色模式；只有用户明确选择过“夜”才进入暗色。
const themeScript = `(function(){try{var s=localStorage.getItem('lnstinct-theme');var d=s==='dark';if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-rust focus:bg-paper focus:px-4 focus:py-2 focus:text-rust dark:focus:bg-night dark:focus:text-rust-soft"
        >
          跳到主内容
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
