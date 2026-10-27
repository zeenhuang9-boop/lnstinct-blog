import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { PostInput } from '@/lib/content/types';

let tempDir: string;
let getRss: () => Promise<Response>;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'lnstinct-rss-'));
  process.env.LNSTINCT_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // siteConfig 在模块加载时读取 NEXT_PUBLIC_SITE_URL，重置模块后再导入路由。
  vi.resetModules();
  const { createFileContentRepository } = await import('@/lib/content/file-repository');
  const { GET } = await import('../app/rss.xml/route');

  const repository = createFileContentRepository();
  const input: PostInput = {
    kind: 'article',
    title: 'RSS 回归测试',
    summary: '摘要',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文' }] }] },
    tags: [],
  };
  const draft = await repository.createPost(input);
  await repository.setPostStatus(draft.id, 'published');

  getRss = GET as unknown as () => Promise<Response>;
});

afterAll(async () => {
  delete process.env.LNSTINCT_DATA_DIR;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  await rm(tempDir, { recursive: true, force: true });
});

describe('GET /rss.xml', () => {
  it('文章链接与 guid 不带双斜杠', async () => {
    const response = await getRss();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('https://example.com/articles/');
    expect(xml).not.toContain('https://example.com//');
  });
});
