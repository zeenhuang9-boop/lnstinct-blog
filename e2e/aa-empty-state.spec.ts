import { test, expect } from '@playwright/test';

/**
 * 空状态检查必须最先运行（文件名 aa- 保证排在内容创建测试之前）。
 */
test.describe('空状态（干净数据）', () => {
  test('首页展示 hero 与诚实空状态', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /小泽/ })).toBeVisible();
    await expect(page.getByText('还没有文章')).toBeVisible();
    await expect(page.getByText('还没有项目')).toBeVisible();
  });
});
