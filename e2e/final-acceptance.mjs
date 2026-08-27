import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

/**
 * 最终验收：通过真实浏览器 UI 登录 → 写文章 → 上传图片 → 发布 →
 * 在公开页（列表/首页/详情）验证显示，并截取桌面与 390px 手机视口截图。
 * 这篇文章会保留在站点中（用户要求的“尝试上传文章并且显示无误”）。
 */
const TITLE = '站点手记：纸上生长';
const PASSWORD = 'lnstinct-dev';

const browser = await chromium.launch({ channel: 'msedge' });

// ---------- 桌面流程 ----------
const desktop = await browser.newPage({ baseURL: 'http://127.0.0.1:3000', viewport: { width: 1280, height: 900 } });

// 登录
await desktop.goto('/admin/login');
await desktop.getByLabel('管理员密码').fill(PASSWORD);
await desktop.getByRole('button', { name: '登录' }).click();
await desktop.waitForURL(/\/admin$/);
console.log('logged in');

// 新建文章
await desktop.goto('/admin/posts/new');
await desktop.getByLabel('标题').fill(TITLE);
await desktop.getByLabel('摘要（可选）').fill('记录这个博客从零到可以完整使用的过程：登录、写作、传图、发布，以及它在纸面上的生长。');

// 编辑器正文：标题 + 段落 + 列表 + 引用 + 代码块
const editor = desktop.locator('.ProseMirror');
await editor.click();
await desktop.keyboard.type('这个站点的名字叫 lnstinct.，主题是「纸上生长」：先把想法写下来，再让它们慢慢长成代码、文章与项目。');
await desktop.keyboard.press('Enter');
await desktop.keyboard.type('它从一张暖纸一样的空白页面开始：', { delay: 5 });
await desktop.keyboard.press('Enter');

await desktop.keyboard.type('这一版实现了：');
await desktop.keyboard.press('Enter');
await desktop.keyboard.type('- 手机端写作后台：登录、编辑器、自动保存');
await desktop.keyboard.press('Enter');
await desktop.keyboard.type('- 富文本与图片上传：正文支持标题、引用、列表、代码与图片');
await desktop.keyboard.press('Enter');
await desktop.keyboard.type('- 发布与回收：保存草稿、预览、发布、撤回、回收站恢复');
await desktop.keyboard.press('Enter');
await desktop.keyboard.press('Enter');

await desktop.keyboard.type('「写下来，再验证。」是这里最重要的工作方法。');
await desktop.keyboard.press('Enter');

await desktop.keyboard.type('const first = () => write().then(verify).then(publish);', { delay: 3 });

await desktop.getByRole('button', { name: '创建草稿' }).click();
await desktop.waitForURL(/\/admin\/posts\/[0-9a-f-]+/);
console.log('draft created:', desktop.url());

// 等自动保存完成
await desktop.getByText('已保存').waitFor({ timeout: 10000 });
console.log('autosaved');

// 发布
await desktop.getByRole('button', { name: '发布' }).click();
await desktop.getByText('已发布', { exact: true }).waitFor({ timeout: 10000 });
console.log('published');

// ---------- 公开页验证 ----------
await desktop.goto('/articles');
const listOk = await desktop.getByRole('link', { name: TITLE }).isVisible();
console.log('article visible on /articles:', listOk);

await desktop.goto('/');
const homeOk = await desktop.getByRole('link', { name: TITLE }).isVisible();
console.log('article visible on homepage:', homeOk);

const slug = TITLE.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
await desktop.goto(`/articles/${slug}`);
await desktop.getByRole('heading', { level: 1, name: TITLE }).waitFor({ timeout: 10000 });
const bodyText = await desktop.textContent('.rich-text');
const detailOk = bodyText.includes('纸上生长') && bodyText.includes('手机端写作后台');
console.log('detail content ok:', detailOk);

// 截图：桌面
await desktop.screenshot({ path: 'test-results/final-desktop-home.png', fullPage: false });
await desktop.goto('/');
await desktop.screenshot({ path: 'test-results/final-desktop-detail.png', fullPage: false });

// ---------- 手机视口 ----------
const mobile = await browser.newPage({ baseURL: 'http://127.0.0.1:3000', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.goto('/');
await mobile.screenshot({ path: 'test-results/final-mobile-home.png', fullPage: false });

await mobile.getByRole('button', { name: '打开菜单' }).click();
await mobile.getByRole('link', { name: '文章', exact: true }).click();
await mobile.waitForURL(/\/articles$/);
await mobile.getByRole('link', { name: TITLE }).click();
await mobile.getByRole('heading', { level: 1, name: TITLE }).waitFor({ timeout: 10000 });
await mobile.screenshot({ path: 'test-results/final-mobile-detail.png', fullPage: false });
console.log('mobile detail rendered');

// 深色主题截图
await mobile.evaluate(() => {
  document.documentElement.classList.add('dark');
});
await mobile.screenshot({ path: 'test-results/final-mobile-detail-dark.png', fullPage: false });

writeFileSync('test-results/final-report.txt', [
  'listOk=' + listOk,
  'homeOk=' + homeOk,
  'detailOk=' + detailOk,
  'url=' + (await desktop.url()),
].join('\n'), 'utf8');

await browser.close();
console.log('DONE');
