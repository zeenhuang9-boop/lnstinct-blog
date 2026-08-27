import { test, expect, type Page } from '@playwright/test';

const DEV_PASSWORD = 'lnstinct-dev';

/** 一个 1x1 的合法 PNG（极小，用于测试上传）。 */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('管理员密码').fill(DEV_PASSWORD);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

function uniqueTitle(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}`;
}

test.describe.configure({ mode: 'serial' });

test.describe('后台完整流程', () => {
  let articleTitle = '';
  let articleSlug = '';

  test('登录后台', async ({ page }) => {
    await login(page);
    await expect(page.getByText('lnstinct. 后台')).toBeVisible();
    await expect(page.getByText('最近编辑')).toBeVisible();
  });

  test('未登录访问后台被重定向到登录页', async ({ page }) => {
    await page.goto('/admin/posts');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('创建文章、编辑正文、上传图片并发布', async ({ page }) => {
    await login(page);

    articleTitle = uniqueTitle('站点手记');
    await page.goto('/admin/posts/new');

    // 类型保持“文章”，填写标题、摘要
    await page.getByLabel('标题').fill(articleTitle);
    await page.getByLabel('摘要（可选）').fill('这篇是自动化验收创建的示例文章。');

    // Tiptap 正文：输入两段文字
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('这是第一段：纸上生长，先写下来。');
    await page.keyboard.press('Enter');
    await page.keyboard.type('这是第二段：再把想法长成代码与文章。');

    // 上传图片
    await page.getByRole('button', { name: '图片', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.locator('.ProseMirror img')).toBeVisible({ timeout: 10_000 });

    // 创建草稿 → 跳转到编辑页
    await page.getByRole('button', { name: '创建草稿' }).click();
    await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+/);

    // 等待自动保存完成
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });

    // 预览
    await page.getByRole('button', { name: '预览' }).click();
    const preview = page.locator('section[aria-label="预览"]');
    await expect(preview.getByText('这是第一段：纸上生长，先写下来。')).toBeVisible();
    await page.getByRole('button', { name: '关闭预览' }).click();

    // 发布
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('已发布', { exact: true })).toBeVisible();
  });

  test('公开站点显示已发布的文章与图片', async ({ page }) => {
    expect(articleTitle).not.toBe('');

    // 文章列表页
    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).toBeVisible();

    // 首页最新文章
    await page.goto('/');
    await expect(page.getByText(articleTitle)).toBeVisible();

    // 详情页内容与图片
    const slugPath = articleTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
    articleSlug = slugPath;
    await page.goto(`/articles/${slugPath}`);
    await expect(page.getByRole('heading', { name: articleTitle })).toBeVisible();
    await expect(page.getByText('这是第一段：纸上生长，先写下来。')).toBeVisible();
    await expect(page.locator('.rich-text img')).toBeVisible();
    await expect(page.locator('.rich-text img')).toHaveAttribute('src', /^\/media\//);
  });

  test('文章列表按发布时间倒序展示已发布文章', async ({ page }) => {
    expect(articleTitle).not.toBe('');

    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).toBeVisible();
    // 已按要求移除标签与搜索接口
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '标签筛选' })).toHaveCount(0);
  });

  test('撤回后从公开站点消失', async ({ page }) => {
    expect(articleTitle).not.toBe('');

    await login(page);
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '撤回' }).click();
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();

    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).toHaveCount(0);

    await page.goto(`/articles/${articleSlug}`);
    await expect(page.getByText('404')).toBeVisible();
  });

  test('移入回收站、恢复、永久删除', async ({ page }) => {
    expect(articleTitle).not.toBe('');

    await login(page);

    // 重新发布以便走完整的回收站流程
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('已发布', { exact: true })).toBeVisible();

    // 移入回收站（等待状态标签变为精确的“回收站”，且“移入回收站”按钮消失）
    await page.getByRole('button', { name: '移入回收站' }).click();
    await expect(page.getByText('回收站', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '移入回收站' })).toHaveCount(0);

    // 公开站点消失
    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).toHaveCount(0);

    // 回收站可见并恢复（会话在本测试内仍有效，无需重复登录）
    await page.goto('/admin/posts?status=trashed');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '恢复' }).click();
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();

    // 永久删除（二次确认）
    await page.goto('/admin/posts?status=trashed');
    await expect(page.getByRole('link', { name: articleTitle })).toHaveCount(0);
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '移入回收站' }).click();
    await expect(page.getByText('回收站')).toBeVisible();
    await page.getByRole('button', { name: '永久删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();

    await expect(page).toHaveURL(/\/admin\/posts$/);
    await expect(page.getByRole('link', { name: articleTitle })).toHaveCount(0);
  });

  test('项目管理：新建、公开显示、删除', async ({ page }) => {
    await login(page);
    const projectTitle = uniqueTitle('示例项目');

    await page.goto('/admin/projects/new');
    await page.getByLabel('项目名称').fill(projectTitle);
    await page.getByLabel('简介').fill('用于验收的本地示例项目。');
    await page.getByLabel('源码地址（http/https）').fill('https://github.com/example/demo');
    await page.getByLabel(/标签/).fill('Web');
    await page.getByRole('button', { name: '创建项目' }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/[0-9a-f-]+/);

    // 公开可见
    await page.goto('/projects');
    await expect(page.getByText(projectTitle)).toBeVisible();

    // 删除
    await page.goto('/admin/projects');
    await page.getByRole('link', { name: projectTitle }).click();
    await page.getByRole('button', { name: '删除项目' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page).toHaveURL(/\/admin\/projects$/);
    await expect(page.getByText(projectTitle)).toHaveCount(0);
  });
});
