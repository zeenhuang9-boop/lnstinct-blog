import { test, expect } from '@playwright/test';
import path from 'node:path';

import { login, uniqueTitle, createPost } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('博客完整使用流程（本地验收）', () => {
  let articleTitle = '';
  let essayTitle = '';

  test('登录：错误密码提示、正确密码进入后台', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel('管理员密码').fill('wrong-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByText('密码不正确')).toBeVisible();

    await login(page);
    await expect(page.getByText('最近编辑')).toBeVisible();
  });

  test('新建并发布文章，公开页面正确显示', async ({ page }) => {
    await login(page);
    articleTitle = uniqueTitle('端到端验收文章');
    await createPost(page, {
      title: articleTitle,
      summary: '这是端到端验收的摘要。',
      body: '正文第一段：验证段落。',
    });

    // 编辑页应显示草稿状态并自动保存成功
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();

    // 发布
    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('已发布', { exact: true })).toBeVisible();

    // 公开文章列表出现该文章
    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).toBeVisible();

    // 详情页内容正确
    await page.getByRole('link', { name: articleTitle }).click();
    await expect(page.getByRole('heading', { level: 1, name: articleTitle })).toBeVisible();
    await expect(page.getByText('这是端到端验收的摘要。')).toBeVisible();
    await expect(page.getByText('正文第一段：验证段落。')).toBeVisible();

    // 首页最新文章出现
    await page.goto('/');
    await expect(page.getByRole('link', { name: articleTitle })).toBeVisible();
  });

  test('学习记录：学习类内容显示在 /learning（/essays 重定向）', async ({ page }) => {
    await login(page);
    essayTitle = uniqueTitle('端到端验收学习记录');
    await createPost(page, {
      title: essayTitle,
      summary: '学习记录摘要。',
      kind: 'article',
      body: '学习记录正文内容。',
    });

    // 复现真实操作：先按文章写作并保存，再改成学习记录。
    await page.locator('#post-kind').selectOption('learning');
    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect(page.getByText('已保存').first()).toBeVisible();

    await page.goto('/admin/posts');
    const item = page.getByRole('link', { name: essayTitle }).locator('..');
    await expect(item).toContainText('学习记录');
    await expect(item).not.toContainText('散文');
    await page.getByRole('link', { name: essayTitle }).click();

    await page.getByRole('button', { name: '发布' }).click();
    await expect(page.getByText('已发布', { exact: true })).toBeVisible();

    // 学习记录显示在 /learning。
    await page.goto('/learning');
    await expect(page.getByRole('link', { name: essayTitle })).toBeVisible();

    // 旧 /essays 路径重定向到 /learning。
    await page.goto('/essays');
    await expect(page).toHaveURL(/\/learning$/);
  });

  test('图片上传：编辑器上传图片并在公开页面显示', async ({ page }) => {
    await login(page);
    // 使用已发布的文章，进入编辑页补充图片
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await expect(page.getByRole('heading', { level: 1, name: '编辑内容' })).toBeVisible();

    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.press('Enter');
    await page.getByRole('button', { name: '图片', exact: true }).click();

    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'sample.png');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    // 编辑器内出现图片节点
    await expect(editor.locator('img')).toBeVisible();

    // 保存草稿，回到公开页验证图片渲染
    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect(page.getByText('已保存').first()).toBeVisible();

    await page.goto('/articles');
    await page.getByRole('link', { name: articleTitle }).click();
    await expect(page.locator('.rich-text img')).toBeVisible();
    await expect(page.locator('.rich-text img')).toHaveAttribute('src', /^\/media\//);
  });

  test('撤回：公开页面不再显示', async ({ page }) => {
    await login(page);
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '撤回' }).click();
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();

    await page.goto('/articles');
    await expect(page.getByRole('link', { name: articleTitle })).not.toBeVisible();
  });

  test('回收站：移入、恢复、永久删除', async ({ page }) => {
    await login(page);
    // 移入回收站
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '移入回收站' }).click();
    await expect(page.getByText('回收站', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '移入回收站' })).toHaveCount(0);

    // 回收站列表可见
    await page.goto('/admin/posts?status=trashed');
    await expect(page.getByRole('link', { name: articleTitle })).toBeVisible();

    // 恢复
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '恢复' }).click();
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();

    // 永久删除需要二次确认
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: articleTitle }).click();
    await page.getByRole('button', { name: '移入回收站' }).click();
    await page.getByRole('button', { name: '永久删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();

    // 删除后列表不再出现（先删除散文也清理掉）
    await page.waitForURL(/\/admin\/posts/);
    await expect(page.getByRole('link', { name: articleTitle })).not.toBeVisible();
  });

  test('清理学习记录，恢复首发为空的状态', async ({ page }) => {
    await login(page);
    await page.goto('/admin/posts');
    await page.getByRole('link', { name: essayTitle }).click();
    await page.getByRole('button', { name: '移入回收站' }).click();
    await expect(page.getByText('回收站', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '永久删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await page.waitForURL(/\/admin\/posts/);
    await expect(page.getByRole('link', { name: essayTitle })).not.toBeVisible();
  });
});
