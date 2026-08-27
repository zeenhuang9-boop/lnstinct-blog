import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const ADMIN_PASSWORD = 'lnstinct-dev';

/** 生成带时间戳的标题，避免与本地持久化数据冲突。 */
export function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

/** 幂等登录：已登录（会话 cookie 有效）时直接返回；否则走登录表单。 */
export async function login(page: Page): Promise<void> {
  await page.goto('/admin/login');

  // 已持有有效会话时 /admin/login 会重定向到 /admin。
  if (page.url().includes('/admin') && !page.url().includes('/admin/login')) {
    return;
  }

  await page.getByLabel('管理员密码').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('lnstinct. 后台')).toBeVisible();
}

export async function createPost(
  page: Page,
  {
    title,
    summary,
    kind = 'article',
    body,
  }: {
    title: string;
    summary?: string;
    kind?: 'article' | 'learning';
    body?: string;
  },
): Promise<void> {
  await login(page);
  await page.goto('/admin/posts/new');
  await page.locator('#post-kind').selectOption(kind);
  await page.locator('#post-title').fill(title);

  if (summary) {
    await page.locator('#post-summary').fill(summary);
  }

  const editor = page.locator('.ProseMirror');
  await editor.click();

  if (body) {
    await editor.pressSequentially(body);
  } else {
    await editor.pressSequentially('这是一段用于端到端验收的正文内容，验证富文本渲染正确。');
  }

  await page.getByRole('button', { name: '创建草稿' }).click();

  // 创建成功会重定向到编辑页（URL 含 id）
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]+$/);
}
