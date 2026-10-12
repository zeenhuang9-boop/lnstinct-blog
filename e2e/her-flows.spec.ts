import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { HerProfile } from '../src/content/her';
import { describeBirthday, daysTogether } from '../src/lib/date/birthday';
import { photoAnchorId, collectConsoleErrors, expectNoPageErrors, todayInTimeZone } from './her-helpers';

/**
 * 「她」空间的核心交互：倒计时数字、跨页互链、原位放大、空状态。
 *
 * 设计原则：
 * - 期望值一律从**页面同款来源**算出来（当轮生效的内容 + `describeBirthday` / `daysTogether`），
 *   不写死数字 —— 否则生日一过或者内容一改，测试就假红。
 * - 内容来源是 `data/her.json`（由 `e2e/global-setup.ts` 写入的**测试种子**），
 *   不是 `src/content/her.ts` 的默认值：三页接线数据源后渲染的是前者，
 *   用后者当基准会在内容被后台改过之后假红。
 * - 需要「内容里配了照片」才成立的用例，先读内容文件判断；没配就 skip 并写明启用条件，
 *   绝不写一个永远通过的假测试。
 * - 选择器按真实渲染的 DOM 写：数字卡没有 data 属性，靠可见文案定位；
 *   查看器用 `role="dialog"` + `aria-label="照片查看器"`。
 */

/** 照片墙用的路径前缀，与内容模块的 PHOTO_DIR 一致。 */
const PHOTO_DIR = '/media/her';

/** 「她」内容文件的位置（与 `e2e/global-setup.ts` 的解析方式保持一致）。 */
const HER_DATA_FILE = path.join(
  process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data'),
  'her.json',
);

/** 内容不可用时统一跳过，并写清启用条件。 */
const NO_SEED_REASON =
  `没有读到内容文件 ${HER_DATA_FILE}。` +
  '该文件由 e2e/global-setup.ts 在每轮 E2E 开始时写入测试种子；' +
  '启用条件：先跑一次 npx playwright test（会执行 globalSetup），或确认被测服务端能用数据源读到内容。';

/**
 * 读当轮真正生效的内容。
 *
 * **必须每次现读，不能缓存**。两个原因，都是实测踩出来的：
 * 1. spec 模块会在「测试收集阶段」就被求值一次，而 `e2e/global-setup.ts` 更晚才写文件；
 *    如果那次读失败就把 null 缓存下来，后面所有用例都会被误判成 skip
 *    （实测后果：19 条 her-flows 用例全被跳过，看起来「通过」其实一条没跑）。
 * 2. 「对称用例」会临时改写内容文件，缓存会让它读到旧值。
 *
 * 文件很小、读取次数很少，现读的开销可以忽略，换来的是不会读到过期状态。
 */
function seededProfileOrNull(): HerProfile | null {
  try {
    return JSON.parse(readFileSync(HER_DATA_FILE, 'utf8')) as HerProfile;
  } catch {
    return null;
  }
}

/** 取内容；取不到就抛错，让用例明确失败而不是静默跳过。 */
function seededProfile(): HerProfile {
  const profile = seededProfileOrNull();

  if (profile === null) {
    throw new Error(NO_SEED_REASON);
  }

  return profile;
}

/** 在用例开头统一声明前置条件：读不到内容就跳过。 */
function requireSeeded(): void {
  test.skip(seededProfileOrNull() === null, NO_SEED_REASON);
}

/** 内容里登记的全部照片文件名。 */
function photoFiles(): readonly string[] {
  return (seededProfileOrNull()?.photos ?? []).map((photo) => photo.file);
}

type SeededEvent = HerProfile['timeline'][number];

/** 带照片的事件（时间线上会渲染缩略图链接的那种）。 */
function eventsWithPhotos(): readonly SeededEvent[] {
  return (seededProfileOrNull()?.timeline ?? []).filter(
    (event) => (event.photos ?? []).length > 0,
  );
}

/** 没挂照片的事件（时间线上显示「待补」虚线空位）。 */
function eventsWithoutPhotos(): readonly SeededEvent[] {
  return (seededProfileOrNull()?.timeline ?? []).filter(
    (event) => (event.photos ?? []).length === 0,
  );
}

/** 取事件挂的第一张照片文件名；没有照片时返回 null（`photos` 可选，`[0]` 也可能是 undefined）。 */
function firstPhotoFile(event: { readonly photos?: readonly string[] }): string | null {
  const [file] = event.photos ?? [];
  return typeof file === 'string' && file.length > 0 ? file : null;
}

/** 取数组第一个元素，取不到就抛错（测试数据前提不成立时，要明确失败而不是静默跳过）。 */
function firstOrThrow<T>(items: readonly T[], message: string): T {
  const [first] = items;

  if (first === undefined) {
    throw new Error(message);
  }

  return first;
}

/** 归一化文案：去掉所有空白，避免 HTML 换行/缩进影响包含判断。 */
function normalize(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * 定位某张数字卡（数字卡没有 data 属性，只能靠含说明行文案的那个容器来找）。
 * `label` 用可见文案片段，如「距离下一次生日」。
 */
function statCard(page: Page, label: string): Locator {
  return page.locator('p').filter({ hasText: label }).first().locator('xpath=..');
}

/** 读出数字卡里的当前值（大号数字那个 span 的文本）。 */
async function statValue(card: Locator): Promise<string> {
  return normalize(await card.locator('span').nth(1).innerText());
}

test.describe('「她」主页：倒计时与统计卡', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('生日倒计时数字与 describeBirthday 的算法结果一致', async ({ page }) => {
    const today = todayInTimeZone();
    const expected = describeBirthday(today, seededProfile().birthday);

    const errors = collectConsoleErrors(page);
    await page.goto('/her');

    const card = statCard(page, '生日');
    await expect(card, '主页应有生日数字卡').toBeVisible();

    const value = await statValue(card);

    if (expected.isToday) {
      // 生日当天：显示「今天」状态词，而不是「0 天」。
      expect(value, '生日当天应显示「今天」而不是 0').toBe('今天');
    } else {
      expect(
        value,
        `倒计时数字应为现算值 ${expected.daysUntil}（今天 ${today.year}-${today.month}-${today.day}，时区 Asia/Shanghai），实际读到「${value}」`,
      ).toBe(String(expected.daysUntil));
    }

    // 生日月日必须与内容一致，不能是别的日期。
    await expect(card).toContainText(String(seededProfile().birthday.day));

    expectNoPageErrors(errors);
  });

  test('hero 显示昵称与年份', async ({ page }) => {
    const profile = seededProfile();

    await page.goto('/her');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText(profile.displayName);
    await expect(h1).toContainText(profile.heroYear);
  });

  test('倒计时是每次请求现算，不是构建期冻结的常数', async ({ page }) => {
    // 这条防的是 roadmap §3.2 点名的坑：页面被静态化后数字会一直停在构建那天。
    // 判定方式：数字必须等于「按当天算」的结果，而不是任何固定常数。
    const today = todayInTimeZone();
    const expected = describeBirthday(today, seededProfile().birthday);

    const response = await page.goto('/her');
    const value = await statValue(statCard(page, '生日'));

    if (expected.isToday) {
      expect(value).toBe('今天');
    } else {
      expect(
        value,
        `倒计时应为现算值 ${expected.daysUntil}，实际「${value}」；若为固定常数说明页面被静态化了`,
      ).toBe(String(expected.daysUntil));
    }

    // 响应头里的 no-cache/no-store 能佐证这一页没有走静态缓存。
    // Next 16 对 force-dynamic 发的是 `no-cache, must-revalidate`（不是 no-store），
    // 两者都保证不会命中静态缓存，所以这里两种都接受。
    const cacheControl = response?.headers()['cache-control'] ?? '';
    expect(
      /no-store|no-cache/.test(cacheControl),
      `force-dynamic 页面应禁止静态缓存，实际 cache-control="${cacheControl}"`,
    ).toBe(true);
  });

  test('纪念日没填时第二张卡用真实建页天数，且脚注写明「待填」', async ({ page }) => {
    const profile = seededProfile();

    await page.goto('/her');

    if (profile.since === null) {
      // since 为 null 时，第二张卡用的是**真实已知**的建页日（pageBuiltOn），
      // 不是「待填」——「待填」只属于纪念日那种确实未知的字段，放在脚注那一行。
      const standing = statCard(page, '站在这页上的时间');
      await expect(standing, 'since 为空时应显示「站在这页上的时间」这张卡').toBeVisible();

      // 主值必须是 daysTogether(today, pageBuiltOn) 的真实结果，用同一个纯函数算，不写死 0。
      const today = todayInTimeZone();
      const expectedStanding = daysTogether(today, profile.pageBuiltOn);
      expect(
        expectedStanding,
        `内容里的 pageBuiltOn「${profile.pageBuiltOn}」应是合法的 YYYY-MM-DD`,
      ).not.toBeNull();

      const value = await statValue(standing);
      expect(
        value,
        `第二张卡主值应为 daysTogether(today, pageBuiltOn) = ${expectedStanding}（今天 ${today.year}-${today.month}-${today.day}），实际「${value}」`,
      ).toBe(String(expectedStanding));

      // 同一时刻页面上必须有「待填」字样（在脚注里），提醒纪念日还没填。
      await expect(page.getByText('在一起纪念日 · 待填')).toBeVisible();

      // 且绝不能把某个数字标成「已走过」——那是编造一个未知的日子。
      await expect(
        statCard(page, '已走过的日子'),
        'since 为空时不应出现「已走过的日子」这张卡（不能用 0 或别的数字冒充）',
      ).toHaveCount(0);
    } else {
      // since 有值：应显示「已走过 N 天」，数字与 daysTogether 同源。
      const today = todayInTimeZone();
      const expectedTogether = daysTogether(today, profile.since);
      expect(expectedTogether).not.toBeNull();

      const together = statCard(page, '已走过的日子');
      await expect(together, 'since 有值时应显示「已走过的日子」这张卡').toBeVisible();

      const value = await statValue(together);
      expect(value, `「已走过」应为 daysTogether(today, since) = ${expectedTogether}`).toBe(
        String(expectedTogether),
      );

      // 纪念日填了以后，脚注那行「待填」应消失。
      await expect(page.getByText('在一起纪念日 · 待填')).toHaveCount(0);
    }
  });

  test('纪念日填了之后第二张卡切换成「已走过的日子」、脚注消失（对称用例）', async ({
    page,
  }) => {
    // 这条覆盖「since 有值」的分支。种子里的 since 是 null，所以这里临时改内容文件，
    // 断言完在 finally 里**原样写回**；否则这条分支没有数据可测。
    // 写回的是原始字节，因此即使用例中途失败也不会把内容改坏。
    const originalRaw = readFileSync(HER_DATA_FILE, 'utf8');
    const original = JSON.parse(originalRaw) as HerProfile;
    const pastSince = '2025-12-13';
    const today = todayInTimeZone();
    const expectedTogether = daysTogether(today, pastSince);

    expect(expectedTogether, `${pastSince} 应是合法日期`).not.toBeNull();

    try {
      writeFileSync(
        HER_DATA_FILE,
        `${JSON.stringify({ ...original, since: pastSince }, null, 2)}\n`,
        'utf8',
      );

      await page.goto('/her');

      const together = statCard(page, '已走过的日子');
      await expect(together, 'since 有值时应切成「已走过的日子」').toBeVisible();
      await expect(together).toContainText('在一起纪念日');

      const value = await statValue(together);
      expect(
        value,
        `「已走过」应为 daysTogether(${today.year}-${today.month}-${today.day}, ${pastSince}) = ${expectedTogether}，实际「${value}」`,
      ).toBe(String(expectedTogether));

      // 填了纪念日之后，「站在这页上的时间」与脚注「待填」都该消失。
      await expect(
        statCard(page, '站在这页上的时间'),
        'since 有值时不应再显示建页时间那张卡',
      ).toHaveCount(0);
      await expect(page.getByText('在一起纪念日 · 待填')).toHaveCount(0);
    } finally {
      writeFileSync(HER_DATA_FILE, originalRaw, 'utf8');
    }

    // 还原之后确认内容确实回到了 since: null，证明写回真的生效。
    expect(
      seededProfileOrNull()?.since,
      '用例结束后内容文件应已还原成 since: null',
    ).toBeNull();
  });
});

test.describe('「她」空间：跨页互链（核心设计）', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('时间线缩略图 → 照片墙对应锚点，且目标元素可见', async ({ page }) => {
    test.skip(
      eventsWithPhotos().length === 0,
      '内容里没有任何事件挂照片（timeline[].photos 全为空），时间线不会渲染缩略图，本条无法成立。' +
        "启用条件：给某个事件填 photos: ['文件名.jpg']，并在 photos 里登记同名文件、" +
        '把图片放进 public/media/her/。',
    );

    const event = firstOrThrow(eventsWithPhotos(), '断言失败：应该存在带照片的事件');
    const file = firstPhotoFile(event);

    if (file === null) {
      throw new Error('该事件声明了 photos，但取不到有效文件名，测试数据前提不成立');
    }

    const expectedAnchor = photoAnchorId(file);
    const errors = collectConsoleErrors(page);

    await page.goto('/her');

    // 时间线上该事件的缩略图是一个链接，指向照片墙的锚点。
    const thumbnail = page.locator(`a[href*="${expectedAnchor}"]`).first();
    await expect(thumbnail, `时间线上应有指向 ${expectedAnchor} 的缩略图链接`).toBeVisible();

    const href = await thumbnail.getAttribute('href');
    expect(href, '缩略图链接应精确指向 /her/photos 加锚点').toBe(`/her/photos#${expectedAnchor}`);

    // 真的点一遍，而不是只检查 href 存在。
    await thumbnail.click();
    await expect(page).toHaveURL(new RegExp(`/her/photos#${expectedAnchor}$`));

    // 目标元素必须存在且可见（锚点落地后浏览器会滚过去）。
    const target = page.locator(`#${expectedAnchor}`);
    await expect(target).toBeVisible();

    // 锚点落地的真实证据：目标元素应进入视口。
    await expect(target).toBeInViewport();

    // 目标元素里应该有这张照片本身（而不是只框住一块空白）。
    await expect(target.locator('img')).toHaveAttribute('src', `${PHOTO_DIR}/${file}`);

    expectNoPageErrors(errors);
  });

  test('照片墙分组标题 → 回主页时间线对应事件', async ({ page }) => {
    const firstEvent = firstOrThrow(seededProfile().timeline, '内容里没有任何时间线事件');

    await page.goto('/her/photos');

    // 组标题是链接，指回 /her#<事件 id>。
    const headingLink = page.locator(`a[href="/her#${firstEvent.id}"]`).first();
    await expect(headingLink, `照片墙上应有回时间线「${firstEvent.title}」的标题链接`).toBeVisible();

    await headingLink.click();
    await expect(page).toHaveURL(new RegExp(`/her#${firstEvent.id}$`));

    const eventAnchor = page.locator(`#${firstEvent.id}`);
    await expect(eventAnchor).toBeVisible();
    await expect(eventAnchor).toBeInViewport();
  });

  test('主页「照片墙 →」入口到达 /her/photos', async ({ page }) => {
    await page.goto('/her');

    const entry = page.getByRole('link', { name: /照片墙/ }).first();
    await expect(entry).toBeVisible();
    await entry.click();

    await expect(page).toHaveURL(/\/her\/photos$/);
  });

  test('主页「信 →」入口到达 /her/letter', async ({ page }) => {
    await page.goto('/her');

    const entry = page.getByRole('link', { name: /^信/ }).first();
    await expect(entry).toBeVisible();
    await entry.click();

    await expect(page).toHaveURL(/\/her\/letter$/);
  });

  test('照片墙分组标题与时间线事件同源（不写两套文案）', async ({ page }) => {
    await page.goto('/her/photos');

    // 每个时间线事件都应在照片墙上有一组，组标题文字与该事件的 title 一致。
    for (const event of seededProfile().timeline) {
      const headingLink = page.locator(`a[href="/her#${event.id}"]`).first();

      await expect(headingLink, `照片墙上「${event.title}」这一组的标题链接应存在`).toBeVisible();

      // 标题里除了事件名，还有日期与 sr-only 的「→ 回时间线」，
      // 所以这里只断言事件名被完整包含（同源派生的证据）。
      await expect(headingLink).toContainText(event.title);
    }
  });
});

test.describe('「她」照片墙：照片真实加载', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('照片文件真实存在且能被服务端返回（不是 404 占位）', async ({ request }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片（photos 为空），本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    for (const file of photoFiles()) {
      const response = await request.get(`${PHOTO_DIR}/${file}`);
      expect(response.status(), `${PHOTO_DIR}/${file} 应返回 200，实际 ${response.status()}`).toBe(
        200,
      );
      expect(response.headers()['content-type'], `${file} 的 content-type 应是图片`).toMatch(
        /^image\//,
      );
    }
  });

  test('照片墙上的图片真的解码成功（naturalWidth > 0，不是坏 URL）', async ({ page }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片，照片墙走空状态，本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    const errors = collectConsoleErrors(page);
    await page.goto('/her/photos');

    for (const file of photoFiles()) {
      const anchor = photoAnchorId(file);
      const item = page.locator(`#${anchor}`);
      const image = item.locator('img').first();

      await expect(image, `锚点 ${anchor} 内应有 <img>`).toBeAttached();

      // 图片是 loading="lazy"：先滚进视口再断言，否则它可能还没开始加载。
      await item.scrollIntoViewIfNeeded();

      await expect
        .poll(async () => image.evaluate((el: HTMLImageElement) => el.naturalWidth), {
          message: `${file} 应真的解码成功（naturalWidth > 0），实际一直是 0 —— 说明 URL 是坏的`,
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
    }

    expectNoPageErrors(errors);
  });

  test('时间线缩略图也真的解码成功', async ({ page }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片，时间线不会渲染缩略图，本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    await page.goto('/her');

    const anchor = photoAnchorId(firstOrThrow(photoFiles(), '无照片'));
    const thumbnailImage = page.locator(`a[href*="${anchor}"] img`).first();

    await expect(thumbnailImage).toBeAttached();
    await thumbnailImage.scrollIntoViewIfNeeded();

    await expect
      .poll(async () => thumbnailImage.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        message: '时间线缩略图应真的解码成功',
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
  });
});

test.describe('「她」照片墙：原位放大查看器', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('打开 → Esc 关闭 → 焦点回到原来那张缩略图', async ({ page }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片，照片墙没有可点开的缩略图，本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    await page.goto('/her/photos');

    const anchor = photoAnchorId(firstOrThrow(photoFiles(), '内容里登记了 photos 但列表为空'));

    // 放大按钮有可读名字（roadmap §7 要求，不是裸图标）。
    const trigger = page.locator(`#${anchor}`).getByRole('button', { name: /放大查看/ }).first();
    await expect(trigger, `锚点 ${anchor} 内应有「放大查看」按钮`).toBeVisible();

    // 记住是哪一个触发的，关闭后焦点必须回到它。
    const triggerHandle = await trigger.elementHandle();
    await trigger.click();

    // 打开后出现查看器（role=dialog + 可访问名字）。
    const viewer = page.getByRole('dialog', { name: '照片查看器' });
    await expect(viewer).toBeVisible();

    // Esc 关闭。
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();

    // 焦点回到原缩略图。
    const focusReturned = await triggerHandle?.evaluate((el) => el === document.activeElement);
    expect(focusReturned, '关闭查看器后，焦点应回到原来那张缩略图的按钮上').toBe(true);
  });

  test('查看器可用右上角关闭按钮关闭', async ({ page }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片，本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    await page.goto('/her/photos');

    const anchor = photoAnchorId(firstOrThrow(photoFiles(), '内容里登记了 photos 但列表为空'));
    await page.locator(`#${anchor}`).getByRole('button', { name: /放大查看/ }).first().click();

    const viewer = page.getByRole('dialog', { name: '照片查看器' });
    await expect(viewer).toBeVisible();

    await viewer.getByRole('button', { name: '关闭照片查看器' }).click();
    await expect(viewer).toBeHidden();
  });

  test('打开期间锁住 body 滚动，关闭后恢复', async ({ page }) => {
    test.skip(
      photoFiles().length === 0,
      '内容里没有登记任何照片，本条无法成立。' +
        '启用条件：在内容里登记文件，并把图片放进 public/media/her/。',
    );

    await page.goto('/her/photos');

    const anchor = photoAnchorId(firstOrThrow(photoFiles(), '内容里登记了 photos 但列表为空'));
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);

    await page.locator(`#${anchor}`).getByRole('button', { name: /放大查看/ }).first().click();
    await expect(page.getByRole('dialog', { name: '照片查看器' })).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => document.body.style.overflow), {
        message: '查看器打开时应锁住 body 滚动',
      })
      .toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '照片查看器' })).toBeHidden();

    await expect
      .poll(async () => page.evaluate(() => document.body.style.overflow), {
        message: '关闭查看器后应恢复原来的 body overflow',
      })
      .toBe(overflowBefore);
  });
});

test.describe('「她」照片墙：未归属照片的尾组', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  /**
   * 造一张「没有任何事件引用」的照片。
   *
   * 为什么直接写文件而不是走后台表单：`src/lib/actions/her.ts` 的引用完整性检查会**拒绝**
   * 「已有事件、却存在未归属照片」的整份内容（这是刻意的，避免用户上传后被静默丢内容）。
   * 也就是说这个状态存不下来，只能直接摆一份数据来验渲染层——
   * 而渲染层这一组恰恰是必要的：schema 允许该状态出现，页面就必须能显示它。
   */
  function withUnassignedPhoto(profile: HerProfile, fileName: string): HerProfile {
    return {
      ...profile,
      photos: [...profile.photos, { file: fileName }],
    };
  }

  test('未归属照片出现在尾组，标题不可点，且计数按实际渲染数', async ({ page }) => {
    const originalRaw = readFileSync(HER_DATA_FILE, 'utf8');
    const profile = seededProfile();
    const fileName = 'e2e-unassigned.jpg';
    const anchor = photoAnchorId(fileName);
    const expectedRendered = profile.photos.length + 1;

    try {
      writeFileSync(
        HER_DATA_FILE,
        `${JSON.stringify(withUnassignedPhoto(profile, fileName), null, 2)}\n`,
        'utf8',
      );

      await page.goto('/her/photos');

      // 尾组在：标题是「还没归到事件里」，且这张未归属照片真的渲染出来了。
      const group = page.locator('section[aria-labelledby="her-group-her-unassigned"]');
      await expect(group, '有未归属照片时应出现尾组').toBeVisible();
      await expect(group).toContainText('还没归到事件里');
      await expect(group.locator(`#${anchor}`), '未归属照片本身必须可见（不能被静默丢掉）').toBeVisible();

      // 标题不可点：这一组不是时间线上的事件，链回时间线是错的。
      await expect(
        group.locator('h2 a'),
        '尾组标题不应渲染成链接（没有可回的时间线事件）',
      ).toHaveCount(0);

      // 计数按「实际渲染出来的照片数」，不是 profile.photos.length 的另一套算法。
      await expect(
        page.getByText(`共 ${expectedRendered} 张`),
        `页面应写「共 ${expectedRendered} 张」（含未归属的那张）`,
      ).toBeVisible();
    } finally {
      writeFileSync(HER_DATA_FILE, originalRaw, 'utf8');
    }

    // 还原后尾组必须消失（不留空壳）。
    await page.goto('/her/photos');
    await expect(
      page.locator('section[aria-labelledby="her-group-her-unassigned"]'),
      '全部照片都有归属时尾组不应出现',
    ).toHaveCount(0);
    await expect(page.getByText(`共 ${profile.photos.length} 张`)).toBeVisible();
  });
});

test.describe('「她」空状态文案', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('信还没写时显示空状态文案，而不是空白页', async ({ page }) => {
    test.skip(
      seededProfile().letter.paragraphs.length > 0,
      `内容里的信已经有 ${seededProfile().letter.paragraphs.length} 段正文，不再走空状态分支。` +
        '启用条件：把 letter.paragraphs 清空为 []。',
    );

    await page.goto('/her/letter');

    await expect(page.getByText('这封信还没写完')).toBeVisible();
  });

  test('没有照片的事件在时间线上显示「待补」，而不是破图', async ({ page }) => {
    test.skip(
      eventsWithoutPhotos().length === 0,
      '内容里每个事件都挂了照片，没有「无照片」的事件可验。' +
        '启用条件：让至少一个事件的 photos 为空数组或不填。',
    );

    await page.goto('/her');

    const event = firstOrThrow(eventsWithoutPhotos(), '断言失败：应该存在没有照片的事件');
    const item = page.locator(`#${event.id}`);

    await expect(item).toBeVisible();
    await expect(item).toContainText('待补');
    await expect(item.locator('img'), '没有照片的事件不应渲染 <img>（避免破图）').toHaveCount(0);
  });

  test('照片墙上没有照片的组显示空位文案，且组内不含 <img>', async ({ page }) => {
    test.skip(
      eventsWithoutPhotos().length === 0,
      '内容里每个事件都挂了照片，没有「无照片」的组可验。' +
        '启用条件：让至少一个事件的 photos 为空数组或不填。',
    );

    await page.goto('/her/photos');

    const event = firstOrThrow(eventsWithoutPhotos(), '断言失败：应该存在没有照片的事件');
    // 组用 aria-labelledby 指向标题，标题里是回时间线的链接。
    const headingLink = page.locator(`a[href="/her#${event.id}"]`).first();
    const group = headingLink.locator('xpath=ancestor::section[1]');

    await expect(group).toContainText('等你的照片');
    await expect(group.locator('img'), '空组不应渲染任何 <img>').toHaveCount(0);
  });
});
