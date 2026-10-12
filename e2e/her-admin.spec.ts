import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';

import type { HerProfile } from '../src/content/her';
import { collectConsoleErrors, expectNoPageErrors } from './her-helpers';
import { login } from './helpers';

/**
 * 「她」内容可编辑的**真实闭环**：登录后台 → /admin/her → 改字段 → 保存 → 公开页断言新值 → 改回原值。
 *
 * 三条重要约定：
 * 1. **数据隔离由 globalSetup/globalTeardown 负责**，本文件不做备份还原。
 *    每轮 E2E 开始时 `e2e/global-setup.ts` 把真实 `data/her.json` 备份到 `.her-seed-backup.json`
 *    并写入测试种子；跑完 `e2e/global-teardown.ts` 原样还原。所以我在这里改内容是安全的。
 * 2. **断言基准是种子内容**（从 `data/her.json` 现读），不是 `src/content/her.ts` 的默认值 ——
 *    后台保存写的是前者，公开页读的也是前者。
 * 3. **必须断言「改动前 vs 改动后」的差异**，不能只断言「页面有新值」：
 *    一个恒返回种子的页面也能让「有新值」通过。所以每条用例都是「先记原值 → 断言改动前 ≠ 新值
 *    → 保存 → 断言公开页变成新值 → 改回 → 断言回到原值」的四段式。
 *
 * 串行执行：这些用例共用一份内容文件，并行会互相踩。
 */
test.describe.configure({ mode: 'serial' });

const HER_DATA_FILE = path.join(
  process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data'),
  'her.json',
);

/** 现读当轮生效的内容（不要缓存：globalSetup 在测试收集之后才写文件）。 */
function seededProfileOrNull(): HerProfile | null {
  try {
    return JSON.parse(readFileSync(HER_DATA_FILE, 'utf8')) as HerProfile;
  } catch {
    return null;
  }
}

function seededProfile(): HerProfile {
  const profile = seededProfileOrNull();

  if (profile === null) {
    throw new Error(`没有读到内容文件 ${HER_DATA_FILE}（应由 e2e/global-setup.ts 写入测试种子）`);
  }

  return profile;
}

function requireSeeded(): void {
  test.skip(
    seededProfileOrNull() === null,
    `没有读到内容文件 ${HER_DATA_FILE}。启用条件：先跑一次 npx playwright test，让 globalSetup 写入测试种子。`,
  );
}

/** 打开后台「她」编辑页并等到表单就绪。 */
async function openHerForm(page: Page): Promise<void> {
  await login(page);
  await page.goto('/admin/her');
  // 页面 h1 是「她」（后台布局里的标题），表单里的分区标题是 h2（基本 / 大事记 / 照片 / 信）。
  await expect(page.getByRole('heading', { level: 1, name: '「她」' })).toBeVisible();
  await expect(page.locator('#her-display-name')).toBeVisible();
}

/**
 * 点保存，等闭环走到公开页，失败时把表单给出的中文原因抛出来。
 * 保存成功后表单先显示「已保存，正在打开 /her…」，约 600ms 后 push 到 /her。
 */
async function saveAndWaitForPublicPage(page: Page): Promise<void> {
  await page.getByRole('button', { name: /保存并查看 \/her/ }).click();

  // 表单的失败原因渲染在 `<p role="alert">` 里，且只在出错时才存在。
  // 注意不要退化成「任何 .text-rust 元素」：公开页数字卡前面那根 6×34 的锈红竖条
  // 也是一个空文本的元素，会立刻命中并造成「保存失败」的假警报（实测踩过）。
  const errorBox = page.locator('p[role="alert"]').first();

  const outcome = await Promise.race([
    page
      // 注意：这里等的是 pathname 正好为 /her，不是正则 /\/her$/（那会命中 /admin/her）。
      .waitForURL((url) => url.pathname === '/her', { timeout: 15_000 })
      .then(() => 'navigated' as const)
      .catch(() => null),
    errorBox
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'error' as const)
      .catch(() => null),
  ]);

  if (outcome === 'error') {
    throw new Error(`保存失败，表单提示：${(await errorBox.innerText()).trim()}`);
  }

  if (outcome === null) {
    throw new Error('点保存后既没有跳到 /her，也没有出现错误提示（等了 15 秒）。');
  }

  await expectPathname(page, '/her');
  // 等到公开页的 hero 真的渲染出来，避免在导航中途读标题。
  await expect(page.getByRole('heading', { level: 1 })).toContainText('写给');
}

/** /her 上 hero 的一级标题文本。 */
async function heroText(page: Page): Promise<string> {
  return (await page.getByRole('heading', { level: 1 }).innerText()).trim();
}

/**
 * 断言当前 URL 的 pathname 正好是 `exact`。
 *
 * 不要用 `toHaveURL(/\/her$/)`：那个正则**同时匹配 `/admin/her`**，
 * 于是「跳转完成」可能在后台页就被判成立，接着读到的是后台的 h1（实测踩过）。
 */
async function expectPathname(page: Page, exact: string): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `URL pathname 应变成 ${exact}，实际停在 ${new URL(page.url()).pathname}`,
      timeout: 15_000,
    })
    .toBe(exact);
}

test.describe('「她」后台闭环：改内容 → 保存 → 公开页可见', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('改「称呼」：公开页 h1 从原值变为新值，再改回原值', async ({ page }) => {
    const originalName = seededProfile().displayName;
    const newName = 'E2E 闭环验证称呼';

    expect(originalName, '种子称呼与新值不能相同，否则「变化」断言无意义').not.toBe(newName);

    // ---- 改动前：公开页显示的是原值 ----
    await page.goto('/her');
    const beforeText = await heroText(page);
    expect(beforeText, '改动前 hero 应显示内容里的原称呼').toContain(originalName);
    expect(beforeText, '改动前 hero 不应已经显示新值').not.toContain(newName);

    // ---- 在后台改并保存 ----
    await openHerForm(page);
    await expect(page.locator('#her-display-name')).toHaveValue(originalName);
    await page.locator('#her-display-name').fill(newName);
    await saveAndWaitForPublicPage(page);

    // ---- 公开页断言：变成了新值，且不再是原值 ----
    const afterText = await heroText(page);
    expect(afterText, '保存后 hero 应显示新称呼').toContain(newName);
    expect(afterText, '保存后应不再是旧称呼').not.toContain(originalName);
    expect(afterText, 'hero 文本应该真的变了').not.toBe(beforeText);

    // 落盘确认（不只信渲染）
    expect(seededProfileOrNull()?.displayName, '保存应已写入 data/her.json').toBe(newName);

    // ---- 改回原值 ----
    await openHerForm(page);
    await expect(
      page.locator('#her-display-name'),
      '重新打开表单应回填刚保存的新值（证明读的也是同一份数据）',
    ).toHaveValue(newName);
    await page.locator('#her-display-name').fill(originalName);
    await saveAndWaitForPublicPage(page);

    expect(await heroText(page), '收尾后 hero 应回到原值').toContain(originalName);
    expect(seededProfileOrNull()?.displayName, '收尾后内容应还原为种子值').toBe(originalName);
  });

  test('改「副标题」：公开页从原值变为新值，再改回', async ({ page }) => {
    const originalTagline = seededProfile().tagline;
    const newTagline = 'E2E 闭环验证副标题：这一段由测试写入。';

    expect(originalTagline).not.toBe(newTagline);

    await page.goto('/her');
    await expect(page.getByText(originalTagline)).toBeVisible();
    await expect(page.getByText(newTagline)).toHaveCount(0);

    await openHerForm(page);
    await page.locator('#her-tagline').fill(newTagline);
    await saveAndWaitForPublicPage(page);

    await expect(page.getByText(newTagline), '保存后应显示新副标题').toBeVisible();
    await expect(page.getByText(originalTagline), '保存后不应再显示旧副标题').toHaveCount(0);

    await openHerForm(page);
    await page.locator('#her-tagline').fill(originalTagline);
    await saveAndWaitForPublicPage(page);

    await expect(page.getByText(originalTagline)).toBeVisible();
    expect(seededProfileOrNull()?.tagline).toBe(originalTagline);
  });

  test('改「大事记」事件名：照片墙组标题与 /her 时间线同步变化', async ({ page }) => {
    const event = seededProfile().timeline[0];

    if (event === undefined) {
      throw new Error('种子内容里没有时间线事件，本条无法成立');
    }

    const originalTitle = event.title;
    const newTitle = 'E2E 闭环验证事件名';

    expect(originalTitle).not.toBe(newTitle);

    // 改动前：两页都显示原名
    await page.goto('/her');
    await expect(
      page.locator(`#${event.id}`),
      '改动前 /her 时间线应显示原事件名',
    ).toContainText(originalTitle);

    await page.goto('/her/photos');
    await expect(page.locator(`a[href="/her#${event.id}"]`).first()).toContainText(originalTitle);

    // 在后台改事件名并保存。
    // 事件行的 key 是运行时生成的（`draft-N`），不能写死 id，所以按顺序取第 1 条事件的标题输入框；
    // 表单里的顺序与内容文件里 timeline 的顺序一致。
    await openHerForm(page);
    await page.locator('input[id^="her-event-title-"]').first().fill(newTitle);
    await saveAndWaitForPublicPage(page);

    // 公开页：时间线 + 照片墙组标题都跟着变（同源派生的证据）
    await expect(page.locator(`#${event.id}`), '/her 时间线应显示新事件名').toContainText(newTitle);
    await expect(
      page.locator(`#${event.id}`),
      '/her 时间线不应再显示旧事件名',
    ).not.toContainText(originalTitle);

    await page.goto('/her/photos');
    await expect(
      page.locator(`a[href="/her#${event.id}"]`).first(),
      '照片墙组标题应同步显示新事件名（两页同源）',
    ).toContainText(newTitle);

    // 还原
    await openHerForm(page);
    await page.locator('input[id^="her-event-title-"]').first().fill(originalTitle);
    await saveAndWaitForPublicPage(page);

    await page.goto('/her/photos');
    await expect(page.locator(`a[href="/her#${event.id}"]`).first()).toContainText(originalTitle);
    expect(seededProfileOrNull()?.timeline[0]?.title).toBe(originalTitle);
  });

  test('给「信」加一段正文：/her/letter 从空状态变为显示该段；随后删除还原', async ({ page }) => {
    const paragraph = 'E2E 闭环验证段落：这句由测试写入，用来验证后台保存后信页立刻可见。';
    const originalCount = seededProfile().letter.paragraphs.length;

    // 改动前：信是空状态
    await page.goto('/her/letter');
    if (originalCount === 0) {
      await expect(page.getByText('这封信还没写完')).toBeVisible();
    }
    await expect(page.getByText(paragraph)).toHaveCount(0);

    // 加一段
    await openHerForm(page);
    await page.getByRole('button', { name: '+ 加一段' }).click();

    const paragraphBox = page.getByRole('textbox', { name: '第 1 段' });
    await expect(paragraphBox).toBeVisible();
    await paragraphBox.fill(paragraph);

    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    // 公开信页断言新段落
    await page.goto('/her/letter');
    await expect(page.getByText(paragraph), '保存后 /her/letter 应显示新段落').toBeVisible();
    expect(seededProfileOrNull()?.letter.paragraphs, '段落数应 +1').toHaveLength(originalCount + 1);

    // 删掉还原
    await openHerForm(page);
    await page
      .getByRole('textbox', { name: '第 1 段' })
      .locator('xpath=ancestor::div[contains(@class,"flex")][1]')
      .getByRole('button', { name: '删除' })
      .click();

    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    expect(seededProfileOrNull()?.letter.paragraphs, '收尾后段落数应还原').toHaveLength(originalCount);

    await page.goto('/her/letter');
    await expect(page.getByText(paragraph)).toHaveCount(0);
    if (originalCount === 0) {
      await expect(page.getByText('这封信还没写完'), '还原后应回到空状态').toBeVisible();
    }
  });

  test('保存后公开页无 console 报错', async ({ page }) => {
    const originalName = seededProfile().displayName;
    const newName = 'E2E 控制台检查称呼';

    await openHerForm(page);
    await page.locator('#her-display-name').fill(newName);

    // 采集范围刻意**只覆盖保存之后的公开页**：后台表单本身另有一条已知的
    // hydration 不匹配（见 docs/her-verify-report.md 缺陷 10，`her-form.tsx` 的 `nextKey()`），
    // 那条不在本用例的验收范围内，也不该被这条断言顺带判为失败。
    const errors = collectConsoleErrors(page);

    await saveAndWaitForPublicPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(newName);
    await page.goto('/her/photos');

    expectNoPageErrors(errors);

    await openHerForm(page);
    await page.locator('#her-display-name').fill(originalName);
    await saveAndWaitForPublicPage(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(originalName);
  });
});

test.describe('「她」数据源容错：坏文件 / 缺文件都回退默认内容', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('data/her.json 是坏 JSON 时，三页仍 200 且回退到默认内容', async ({ page }) => {
    // 先把原始内容读出来再动手：finally 里要还原成它。
    // （不要在 finally 里现读——那时文件正处在被写坏的状态。）
    const original = readFileSync(HER_DATA_FILE, 'utf8');

    // 三种失败形态各来一次，确保回退不是只对某一种错误生效。
    const brokenCases = [
      { name: '非法 JSON', write: '{ this is not json' },
      { name: '合法 JSON 但校验不过（月份 13）', write: '{"slug":"her","displayName":"x","birthday":{"month":13,"day":1}}' },
      { name: '空文件', write: '' },
    ];

    try {
      for (const broken of brokenCases) {
        writeFileSync(HER_DATA_FILE, broken.write, 'utf8');

        for (const route of ['/her', '/her/photos', '/her/letter']) {
          const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

          expect(
            response?.status(),
            `${broken.name} 时 ${route} 应仍返回 200（回退默认内容，不崩）`,
          ).toBe(200);

          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        }

        // 回退内容里 h1 应有默认称呼（来自 src/content/her.ts 的默认值），而不是种子称呼。
        await page.goto('/her');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('小宇');
      }
    } finally {
      // 交还给 teardown 之前把文件恢复成原始内容，避免影响后面的用例。
      writeFileSync(HER_DATA_FILE, original, 'utf8');
    }
  });

  test('data/her.json 不存在时三页仍 200 且回退默认内容', async ({ page }) => {
    const original = `${JSON.stringify(seededProfile(), null, 2)}\n`;

    try {
      unlinkSync(HER_DATA_FILE);
      expect(existsSync(HER_DATA_FILE)).toBe(false);

      for (const route of ['/her', '/her/photos', '/her/letter']) {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${route} 在内容文件缺失时应仍返回 200`).toBe(200);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    } finally {
      writeFileSync(HER_DATA_FILE, original, 'utf8');
    }
  });
});

test.describe('「她」后台表单：hydration 与字段 id 的确定性（缺陷 10 回归）', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('打开 /admin/her 不出现 hydration 不匹配报错', async ({ page }) => {
    // 缺陷 10：`her-form.tsx` 原本用模块级自增计数器（`draft-N`）拼 htmlFor/id，
    // 服务端与客户端各渲染一次、编号必然不同，React 会报 hydration mismatch 且明确不回补。
    // 这条用例就是那个缺陷的回归闸门——修好之前它会红，修好之后必须绿。
    const errors = collectConsoleErrors(page);

    await login(page);
    await page.goto('/admin/her');
    await expect(page.locator('#her-display-name')).toBeVisible();

    const hydrationIssues = [...errors.consoleErrors, ...errors.pageErrors].filter((text) =>
      /hydrated but some attributes|hydration-mismatch|Hydration failed/i.test(text),
    );

    expect(
      hydrationIssues,
      `打开后台表单不应出现 hydration 不匹配报错：\n${hydrationIssues.join('\n---\n')}`,
    ).toHaveLength(0);

    // 也不该有任何其它 console 报错（favicon 已在 helper 里挡掉，其余都是真报错）。
    expectNoPageErrors(errors);
  });

  test('事件/照片字段的 id 是确定性的渲染下标，不含自增的 draft-N', async ({ page }) => {
    await openHerForm(page);

    const eventIds = await page
      .locator('input[id^="her-event-title-"]')
      .evaluateAll((inputs) => inputs.map((input) => input.id));

    expect(eventIds.length, '种子里应有时间线事件，否则本用例无法成立').toBeGreaterThan(0);

    // 字段 id 的规则（2026-10-12 起）：**纯渲染下标**，形如 her-event-title-0。
    // 曾经用过「事件 id + 下标」与「运行期计数」，前者在事件 id 含中文时不是合法 HTML id，
    // 后者在 SSR/hydration 之间会漂移；纯下标既确定又天然唯一。
    // 行身份（React key）另行派生，**不允许**再拼进 DOM id —— 混用会导致「改一行改两行」。
    for (const id of eventIds) {
      expect(id, `字段 id「${id}」不应含运行时自增的 draft-N`).not.toMatch(/draft-\d+/);
      expect(id, `字段 id「${id}」应形如 her-event-title-<index>`).toMatch(/^her-event-title-\d+$/);
    }

    // 每个 id 必须在同一页里只出现一次（确定性且唯一）。
    expect(new Set(eventIds).size, '字段 id 必须互不重复').toBe(eventIds.length);

    // 照片行的字段 id 同理：纯下标，形如 her-photo-file-0
    const photoFieldIds = await page
      .locator('input[id^="her-photo-file-"]')
      .evaluateAll((inputs) => inputs.map((input) => input.id));

    for (const id of photoFieldIds) {
      expect(id, `照片字段 id「${id}」不应含 draft-N`).not.toMatch(/draft-\d+/);
      expect(id, `照片字段 id「${id}」应形如 her-photo-file-<index>`).toMatch(/^her-photo-file-\d+$/);
    }

    // label 的 htmlFor 必须真的指向存在的控件（hydration 不匹配时这层关联会断）。
    const brokenLabel = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label[for]'));
      return labels
        .map((label) => label.getAttribute('for') ?? '')
        .filter((target) => target !== '' && document.getElementById(target) === null);
    });

    expect(brokenLabel, `这些 label 的 for 指向了不存在的元素：${brokenLabel.join('、')}`).toEqual(
      [],
    );
  });
});

test.describe('「她」后台：照片上传闭环', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('上传一张图并归到事件，保存后照片墙显示它；随后移除', async ({ page }) => {
    const beforeProfile = seededProfile();
    const beforeCount = beforeProfile.photos.length;
    const firstEvent = beforeProfile.timeline[0];

    if (firstEvent === undefined) {
      throw new Error('种子内容里没有时间线事件，照片无处归属，本条无法成立');
    }

    // ---- 在后台加一行照片并上传 ----
    await openHerForm(page);
    await page.getByRole('button', { name: '+ 加一张' }).click();
    // 等新行挂上 DOM 再取 `.last()`，理由见「同一事件挂两张照片」那条用例的注释。
    await expect(page.locator('input[type="file"]')).toHaveCount(2);

    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));

    // 上传成功会把文件名回填，并在该行的提示里显示「已就位：<文件名>」。
    // 用计数而不是 `.last()`：种子那行也显示「已就位」，两者都在时 `.last()` 可能指向种子行。
    await expect(page.locator('p', { hasText: /^已就位：/ })).toHaveCount(2, { timeout: 20_000 });

    // 归到第一条事件：照片墙按事件分组，未归属的照片会被引用完整性检查拦下。
    await page.locator('select').last().selectOption({ label: firstEvent.title });

    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    // ---- 断言：数量 +1，且照片墙上真的出现这张 ----
    const afterProfile = seededProfileOrNull();
    expect(afterProfile?.photos.length, '保存后照片数量应 +1').toBe(beforeCount + 1);

    const uploaded = afterProfile?.photos.at(-1);
    expect(uploaded?.file, '应能在内容文件里找到新上传的照片').toBeTruthy();

    const anchor = `photo-${(uploaded?.file ?? '').replace(/\./g, '-')}`;

    await page.goto('/her/photos');
    await expect(page.locator(`#${anchor}`), '照片墙上应出现新上传的照片').toBeVisible();

    // 图片要真的能解码，不是坏 URL
    const image = page.locator(`#${anchor}`).locator('img').first();
    await expect(image).toBeAttached();
    await expect
      .poll(async () => image.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        message: '新上传的照片应真的解码成功',
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // ---- 移除并还原 ----
    await openHerForm(page);
    await page.getByRole('button', { name: '删除' }).last().click();
    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    expect(seededProfileOrNull()?.photos.length, '收尾后照片数量应还原').toBe(beforeCount);
  });

  test('同一事件挂两张照片：两张都保住归属并在照片墙同组显示（小泽报的 bug 回归）', async ({
    page,
  }) => {
    /**
     * 小泽报的现象：「开始上传照片是正常的，但添加照片后上一张照片就会丧失归属，
     * 显示没有相关事件」「一个事件只能添加一张照片吗？」。
     *
     * 这条用例就是那个现象的回归闸门：**「一个事件只能一张照片」这个断言是错的** ——
     * `HerEvent.photos` 是数组、照片侧 `eventIso` 也允许重复，所以两张都必须保住归属。
     * 断言点是「**先加的那张**」也还在同一事件下，而不只是数量对得上。
     */
    const beforeProfile = seededProfile();
    const firstEvent = beforeProfile.timeline[0];

    if (firstEvent === undefined) {
      throw new Error('种子内容里没有时间线事件，照片无处归属，本条无法成立');
    }

    const beforeCount = beforeProfile.photos.length;
    // 第一条事件原本就挂着几张照片（种子里有 1 张），组内数量断言要按「原有 + 新增」算。
    const attachedBefore = (firstEvent.photos ?? []).length;
    const eventSelector = page.locator('select[id^="her-photo-event-"]');

    await openHerForm(page);

    // 加第一张并上传
    await page.getByRole('button', { name: '+ 加一张' }).click();
    // 关键：等新行**真的挂上 DOM** 再找 `.last()`。点完立刻取 `.last()` 会拿到上一行的输入框，
    // 于是这一次上传写进上一行 —— 表现为「先传的那张被后传的覆盖／丢失」（实测踩过）。
    await expect(page.locator('input[type="file"]')).toHaveCount(2);
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
    // 等**这一行**上传完：它的提示行里会出现文件名。
    // 不能用 `getByText(/已就位：/).last()` —— 第二行还在传时，第一行的「已就位」也是 `.last()`，
    // 会提前放行，然后保存时把还在上传的那行当成空行丢掉（实测：期望 3 张、实际 2 张）。
    await expect(page.locator('p', { hasText: /^已就位：/ })).toHaveCount(1, { timeout: 20_000 });

    // 加第二张并上传（这一步就是触发 bug 的操作）
    await page.getByRole('button', { name: '+ 加一张' }).click();
    await expect(page.locator('input[type="file"]')).toHaveCount(3);
    await page
      .locator('input[type="file"]')
      .last()
      .setInputFiles(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
    // 两行都有文件名才算两张都传完（种子那行也是「已就位」，所以是 3）。
    await expect(page.locator('p', { hasText: /^已就位：/ })).toHaveCount(3, { timeout: 20_000 });

    // 两张都显式归到同一条事件
    await eventSelector.nth(0).selectOption({ label: firstEvent.title });
    await eventSelector.nth(1).selectOption({ label: firstEvent.title });

    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    // ---- 落盘断言：两张都在，且**都**挂在同一条事件的 photos 里 ----
    const after = seededProfileOrNull();
    expect(after?.photos.length, '保存后应有两张照片').toBe(beforeCount + 2);

    const uploadedFiles = (after?.photos ?? [])
      .slice(beforeCount)
      .map((photo) => photo.file);

    expect(uploadedFiles).toHaveLength(2);
    expect(new Set(uploadedFiles).size, '两张照片的文件名应互不相同').toBe(2);

    const event = (after?.timeline ?? []).find((item) => item.id === firstEvent.id);
    const eventPhotos = event?.photos ?? [];

    for (const file of uploadedFiles) {
      expect(
        eventPhotos,
        `事件「${firstEvent.title}」的 photos 里应包含先上传的那张 ${file}（这是 bug 的核心断言）`,
      ).toContain(file);
    }

    // 两张都被事件引用 → 不该有任何一张落进「还没归到事件里」的尾组。
    const referenced = new Set((after?.timeline ?? []).flatMap((item) => item.photos ?? []));
    const orphans = (after?.photos ?? []).filter((photo) => !referenced.has(photo.file));
    expect(orphans.map((photo) => photo.file), '不应有照片失去归属').toEqual([]);

    // ---- 照片墙断言：两张都在同一组里 ----
    await page.goto('/her/photos');

    const group = page.locator(`section[aria-labelledby="her-group-${firstEvent.id}"]`);
    await expect(group, '该事件的组应存在').toBeVisible();
    // 这一组里是「该事件原有的照片 + 新上传的两张」——种子那张本来就挂在第一条事件上，
    // 所以按「原有 + 2」断言，而不是写死 2。
    await expect(group.locator('li[id^="photo-"]'), '原有照片与两张新照片都应在这一组里').toHaveCount(
      attachedBefore + 2,
    );

    for (const file of uploadedFiles) {
      const anchor = `photo-${file.replace(/\./g, '-')}`;
      await expect(
        group.locator(`#${anchor}`),
        `先/后上传的 ${file} 都应出现在该事件的组内`,
      ).toBeVisible();
    }

    // 也不该出现「还没归到事件里」的尾组
    await expect(
      page.locator('section[aria-labelledby="her-group-her-unassigned"]'),
      '两张都有归属时不应出现未归属尾组',
    ).toHaveCount(0);

    // ---- 清理：删掉新增的两张并保存 ----
    await openHerForm(page);
    await page.getByRole('button', { name: '删除' }).last().click();
    await page.getByRole('button', { name: '删除' }).last().click();
    await page.getByRole('button', { name: /保存并查看 \/her/ }).click();
    await expectPathname(page, '/her');

    expect(seededProfileOrNull()?.photos.length, '收尾后照片数量应还原').toBe(beforeCount);
  });
});
