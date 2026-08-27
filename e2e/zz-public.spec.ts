import { test, expect } from '@playwright/test';

/**
 * 公开站点的数据无关检查：导航、404、RSS、robots。
 * 文件以 zz- 开头，保证在内容创建测试之后运行。
 */
test.describe('公开站点', () => {
  test('主导航与各列表页可访问', async ({ page }, testInfo) => {
    await page.goto('/');

    // 手机视口先从汉堡菜单展开导航。
    const isMobile = testInfo.project.name === 'mobile';

    if (isMobile) {
      await page.getByRole('button', { name: '打开菜单' }).click();
      await expect(page.getByRole('button', { name: '打开菜单' })).toHaveAttribute('aria-expanded', 'true');
    }

    await page.getByRole('link', { name: '文章', exact: true }).click();
    await expect(page).toHaveURL(/\/articles$/);
    await expect(page.getByRole('heading', { name: '文章', exact: true })).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: '打开菜单' }).click();
    }

    await page.getByRole('link', { name: '学习记录', exact: true }).click();
    await expect(page).toHaveURL(/\/learning$/);
    await expect(page.getByRole('heading', { name: '学习记录', exact: true })).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: '打开菜单' }).click();
    }

    await page.getByRole('link', { name: '项目', exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);

    if (isMobile) {
      await page.getByRole('button', { name: '打开菜单' }).click();
    }

    await page.getByRole('link', { name: '关于', exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
  });

  test('文章页不显示搜索框与标签筛选', async ({ page }) => {
    await page.goto('/articles');
    await expect(page.getByRole('heading', { name: '文章', exact: true })).toBeVisible();
    // 无搜索框
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
    // 无标签筛选导航
    await expect(page.getByRole('navigation', { name: '标签筛选' })).toHaveCount(0);
    // 无搜索按钮
    await expect(page.getByRole('button', { name: '搜索' })).toHaveCount(0);
  });

  test('404 页面', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('404')).toBeVisible();
  });

  test('RSS 输出有效 XML', async ({ page }) => {
    const response = await page.goto('/rss.xml');
    expect(response?.ok()).toBe(true);
    const body = await response?.text();
    expect(body).toContain('<rss version="2.0"');
  });

  test('robots 允许爬虫并屏蔽后台', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.ok()).toBe(true);
    const body = await response?.text();
    expect(body).toContain('Disallow: /admin');
  });
});
