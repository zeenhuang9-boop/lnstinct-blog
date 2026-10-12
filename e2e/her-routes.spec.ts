import { test, expect } from '@playwright/test';

import { collectConsoleErrors, expectNoPageErrors } from './her-helpers';

/**
 * 「她」空间三页的路由与骨架检查。
 *
 * 数据无关：不假设内容文件里配了几张照片、有没有信，只验三页存在、标题正确、
 * 共用子导航存在且当前页标记正确、无 console 报错。
 */

/** 子导航的可访问名字（见 src/components/her/her-subnav.tsx）。 */
const SUBNAV_NAME = '「她」的子导航';

/** 三页的路径与「当前页」判定文本（子导航项文字来自定稿样式图）。 */
const HER_PAGES = [
  { path: '/her', navLabel: '我们' },
  { path: '/her/photos', navLabel: '照片墙' },
  { path: '/her/letter', navLabel: '信' },
] as const;

test.describe('「她」空间：路由与骨架', () => {
  for (const herPage of HER_PAGES) {
    test(`${herPage.path} 返回 200 且无 console 报错`, async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const response = await page.goto(herPage.path);
      expect(response?.status(), `${herPage.path} 应返回 200`).toBe(200);

      // 页面确实渲染了内容，不是空壳。
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      expectNoPageErrors(errors);
    });
  }

  test('三页都带 robots noindex（不进搜索引擎）', async ({ page }) => {
    for (const herPage of HER_PAGES) {
      await page.goto(herPage.path);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');

      expect(robots, `${herPage.path} 应有 robots meta 且禁止索引`).toBeTruthy();
      expect(robots, `${herPage.path} 的 robots 应含 noindex`).toContain('noindex');
      expect(robots, `${herPage.path} 的 robots 应含 nofollow`).toContain('nofollow');
    }
  });

  test('三页共用子导航，且当前页项带 aria-current="page"', async ({ page }) => {
    for (const herPage of HER_PAGES) {
      await page.goto(herPage.path);

      const subnav = page.getByRole('navigation', { name: SUBNAV_NAME });
      await expect(subnav, `${herPage.path} 应有共用的子导航`).toBeVisible();

      // 三个入口都要在（限定在子导航内：主页正文里还有「照片墙 →」「信 →」入口，
      // 不限定范围会命中多个链接）。
      for (const navItem of HER_PAGES) {
        await expect(
          subnav.getByRole('link', { name: navItem.navLabel, exact: true }),
          `${herPage.path} 的子导航里应能看到「${navItem.navLabel}」`,
        ).toBeVisible();
      }

      // 只有当前页那一项被标记为当前。
      const current = subnav.locator('[aria-current="page"]');
      await expect(current, `${herPage.path} 应有且仅有一个 aria-current="page"`).toHaveCount(1);
      await expect(current, `${herPage.path} 的当前页项应是「${herPage.navLabel}」`).toHaveText(
        herPage.navLabel,
      );

      // 当前项必须指向自己这一页，不能高亮错。
      await expect(current).toHaveAttribute('href', herPage.path);
    }
  });

  test('子导航互相跳转可达（三页闭环）', async ({ page }) => {
    await page.goto('/her');

    const subnav = page.getByRole('navigation', { name: SUBNAV_NAME });

    await subnav.getByRole('link', { name: '照片墙', exact: true }).click();
    await expect(page).toHaveURL(/\/her\/photos$/);

    await subnav.getByRole('link', { name: '信', exact: true }).click();
    await expect(page).toHaveURL(/\/her\/letter$/);

    await subnav.getByRole('link', { name: '我们', exact: true }).click();
    await expect(page).toHaveURL(/\/her$/);
  });

  test('「她」不进主导航，也不进 sitemap', async ({ page }) => {
    // 站点页头里的所有链接，不应包含 /her 任何一页（子导航不在 header 内）。
    await page.goto('/');
    const headerHrefs = await page
      .locator('header a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

    expect(
      headerHrefs.filter((href) => href.startsWith('/her')),
      `站点页头不应包含 /her 入口，实际拿到：${JSON.stringify(headerHrefs)}`,
    ).toEqual([]);

    // sitemap 精确检查：只比对 <loc> 里的路径，避免「/her」作为子串出现在无关 URL 里造成误判。
    const sitemapResponse = await page.goto('/sitemap.xml');
    expect(sitemapResponse?.ok()).toBe(true);
    const sitemap = (await sitemapResponse?.text()) ?? '';
    const locPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
      try {
        return new URL(match[1]).pathname;
      } catch {
        return match[1];
      }
    });

    expect(
      locPaths.filter((pathname) => pathname === '/her' || pathname.startsWith('/her/')),
      `sitemap 不应包含 /her，实际路径：${JSON.stringify(locPaths)}`,
    ).toEqual([]);
  });

  test('三页无需登录即可访问（/her 不在 requireAdmin 保护范围内）', async ({ browser }) => {
    // 用一个全新的、没有任何 cookie 的上下文模拟「没登录的访客」。
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();

    try {
      for (const herPage of HER_PAGES) {
        const response = await anonymousPage.goto(herPage.path);
        expect(response?.status(), `未登录访问 ${herPage.path} 应返回 200 而不是重定向`).toBe(200);
      }
    } finally {
      await anonymous.close();
    }
  });
});
