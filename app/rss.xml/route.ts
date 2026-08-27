import { siteConfig } from '@/config/site';
import { getContentDataSource } from '@/lib/content/data-source';

export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 从富文本正文提取纯文本，用于 RSS 摘要。 */
function plainText(doc: { type: string; content?: unknown[] }): string {
  if (!Array.isArray(doc.content)) {
    return '';
  }

  let out = '';

  for (const node of doc.content as Array<Record<string, unknown>>) {
    if (typeof node.text === 'string') {
      out += node.text;
    }

    if (Array.isArray(node.content)) {
      out += plainText({ type: 'doc', content: node.content });
    }
  }

  return out;
}

export async function GET() {
  const base = siteConfig.url;
  const repository = await getContentDataSource();

  const [articles, learning] = await Promise.all([
    repository.listPublishedPosts({ kind: 'article' }),
    repository.listPublishedPosts({ kind: 'learning' }),
  ]);

  const posts = [...articles, ...learning].sort((a, b) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
  );

  const items = posts
    .map((post) => {
      const basePath = post.kind === 'learning' ? '/learning' : '/articles';
      const path = `${basePath}/${post.slug}`;
      const text = plainText(post.content).slice(0, 500);

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(`${base}/${path}`)}</link>
      <guid>${escapeXml(`${base}/${path}`)}</guid>
      <pubDate>${escapeXml(new Date(post.publishedAt ?? post.createdAt).toUTCString())}</pubDate>
      ${post.summary ? `<description>${escapeXml(post.summary)}</description>` : text ? `<description>${escapeXml(text)}</description>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${siteConfig.name} · ${siteConfig.author}`)}</title>
    <link>${escapeXml(base)}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <atom:link href="${escapeXml(`${base}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
