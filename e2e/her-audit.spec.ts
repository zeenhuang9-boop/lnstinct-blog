import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { HerProfile } from '../src/content/her';
import { daysTogether, describeBirthday, occurrenceOf } from '../src/lib/date/birthday';
import { collectConsoleErrors, expectNoPageErrors, photoAnchorId, todayInTimeZone } from './her-helpers';
import { login } from './helpers';

/**
 * 「她」页面的**对抗性审计**：专门压现有测试没覆盖的组合、边界与极值。
 *
 * 与 her-routes / her-flows / her-admin 的分工：
 * - 那三个 spec 覆盖「路由存在、互链、倒计时、保存闭环」的主干；
 * - 这个 spec 只做主干**旁边**的事：多照片多事件的组合与二次保存、改锚点 id 的连锁、
 *   幂等（重复保存）、空与极值、超长文本的布局、查看器边界、以及后台表单的**行身份**。
 *
 * 两条硬规矩：
 * 1. **断言的是「正确行为」，不是「当前行为」**。所以本文件里红掉的用例 = 真实缺陷，
 *    修好后应当变绿，可以直接当回归闸门用（不使用 test.fail() 把红掩盖成绿）。
 * 2. **改 `data/her.json` 一律 try/finally 原样写回**。种子的隔离由
 *    `e2e/global-setup.ts` / `global-teardown.ts` 负责，本文件只做「测试中间态」的还原，
 *    保证同一次运行里后面的 spec 读到的还是 globalSetup 写的那份种子。
 *
 * 期望值一律从页面同款来源现算（`describeBirthday` / `daysTogether` / 种子内容），
 * 不写死数字与日期，避免生日一过或内容一改就假红。
 *
 * **刻意不用 `test.describe.configure({ mode: 'serial' })`**：serial 模式在第一条失败后会
 * 把同一个 block 里剩下的用例全部标成 skipped —— 审计要的是「每条都给出结论」，
 * 一条红掉不该让其余 20 条失去证据。顺序由 `playwright.config.ts` 的
 * `fullyParallel: false` + `workers: 1` 保证，已经是一个一个跑。
 */

const HER_DATA_FILE = path.join(
  process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data'),
  'her.json',
);

/** 真实存在的图片：所有审计用的照片条目都指向它，保证 <img> 能解码、不引入 404 噪音。 */
const MEDIA_SRC = '/media/her/2026-10-12-01.jpg';

/** 现读当轮生效的内容文件（globalSetup 在收集阶段之后才写，不能缓存在模块作用域）。 */
function raw(): string {
  return readFileSync(HER_DATA_FILE, 'utf8');
}

function seededProfile(): HerProfile {
  return JSON.parse(raw()) as HerProfile;
}

function requireSeeded(): void {
  test.skip(!existsSync(HER_DATA_FILE), `缺少内容文件 ${HER_DATA_FILE}（应由 e2e/global-setup.ts 写入种子）`);
}

/** 覆盖 `data/her.json` 跑一段，无论如何都写回原字节。 */
async function withRawFile<T>(content: string, body: () => Promise<T>): Promise<T> {
  const original = raw();

  writeFileSync(HER_DATA_FILE, content, 'utf8');

  try {
    return await body();
  } finally {
    writeFileSync(HER_DATA_FILE, original, 'utf8');
  }
}

/** 用一份临时的 HerProfile 跑一段（用于造出「多条照片 / 多个事件」这类种子没有的状态）。 */
async function withProfile<T>(profile: HerProfile, body: () => Promise<T>): Promise<T> {
  return withRawFile(`${JSON.stringify(profile, null, 2)}\n`, body);
}

type ProfileOptions = {
  readonly timeline: HerProfile['timeline'];
  readonly photos: HerProfile['photos'];
  readonly displayName?: string;
  readonly tagline?: string;
  readonly birthday?: { month: number; day: number };
  readonly since?: string | null;
  readonly pageBuiltOn?: string;
  readonly letter?: HerProfile['letter'];
};

/** 造一份形状与种子同构的 HerProfile（只用默认值覆盖需要动的那几项）。 */
function makeProfile(options: ProfileOptions): HerProfile {
  const pageBuiltOn = options.pageBuiltOn ?? '2026-10-12';

  return {
    slug: 'her',
    displayName: options.displayName ?? '审计专用称呼',
    tagline: options.tagline ?? '审计专用副标题。',
    birthday: options.birthday ?? { month: 10, day: 11 },
    since: options.since ?? null,
    pageBuiltOn,
    heroYear: pageBuiltOn.slice(0, 4),
    timeline: options.timeline,
    photos: options.photos,
    letter: options.letter ?? { salutation: '审计称呼：', paragraphs: [] },
  };
}

// ────────────────────────────── 表单与页面操作 ──────────────────────────────

const eventRows = (page: Page): Locator =>
  page.locator('section[aria-labelledby="her-timeline-title"] ul > li');

const photoRows = (page: Page): Locator =>
  page.locator('section[aria-labelledby="her-photos-title"] ul > li');

/**
 * 行身份用例（F1/F2/E1）自带数据，**不读种子**。
 *
 * 原因（实测踩到）：`同一事件挂两张照片` 那条 her-admin 用例在断言失败时不会执行清理，
 * 会把 2 张上传照片留在 `data/her.json`；于是我依赖「种子里正好 1 张照片」的用例
 * 就会算错基线（F2a 甚至因此假绿、E1 被 skip）。自带固定数据后，基线与我自己的断言同源。
 */
const FIXTURE_TWO_EVENTS: HerProfile = makeProfile({
  timeline: [
    {
      id: 'audit-e1',
      date: '2026 · 10 · 12',
      iso: '2026-10-12',
      title: '审计事件一',
      photos: ['audit-a.jpg'],
    },
    { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: [] },
  ],
  photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' }],
});

const FIXTURE_ONE_PHOTO: HerProfile = makeProfile({
  timeline: [
    {
      id: 'audit-e1',
      date: '2026 · 10 · 12',
      iso: '2026-10-12',
      title: '审计事件一',
      photos: ['audit-a.jpg'],
    },
  ],
  photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' }],
});

async function openHerForm(page: Page): Promise<void> {
  await login(page);
  await page.goto('/admin/her');
  await expect(page.locator('#her-display-name')).toBeVisible();
  // 表单顶部不该有「文件坏了」的告警：有的话说明数据在上一轮就没还原干净。
  await expect(page.locator('p[role="alert"]'), '打开表单时不应已有错误提示').toHaveCount(0);
}

const saveButton = (page: Page): Locator => page.getByRole('button', { name: /保存并查看 \/her/ });

/**
 * 点保存并等结果。
 * - 跳到 /her → 返回 null（成功）；
 * - 表单出现 `p[role=alert]` → 返回它的中文原因（失败）；
 * - 两者都没有 → 返回一句超时说明，避免把「没反应」当成成功。
 */
async function save(page: Page, timeout = 20_000): Promise<string | null> {
  await saveButton(page).click();

  const errorBox = page.locator('p[role="alert"]').first();
  const outcome = await Promise.race([
    page
      .waitForURL((url) => url.pathname === '/her', { timeout })
      .then(() => 'navigated' as const)
      .catch(() => null),
    errorBox
      .waitFor({ state: 'visible', timeout })
      .then(() => 'error' as const)
      .catch(() => null),
  ]);

  if (outcome === 'error') {
    return (await errorBox.innerText()).trim();
  }

  if (outcome === null) {
    return `（点保存后 ${timeout} ms 内既没有跳到 /her，也没有出现错误提示）`;
  }

  await expect(page.getByRole('heading', { level: 1 })).toContainText('写给');

  return null;
}

/** 点保存并断言成功；失败时把表单原因抛进断言消息。 */
async function saveOk(page: Page): Promise<void> {
  const error = await save(page);

  expect(error, `保存应当成功，实际表单提示：${error ?? ''}`).toBeNull();
}

/** 只点一次「保存」但不等待跳转（用于并发/重复提交探针）。 */
async function clickSaveTwiceInOneTick(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((item) =>
      /保存并查看/.test(item.textContent ?? ''),
    );

    if (button === undefined) {
      throw new Error('没有找到保存按钮');
    }

    // 同一个 tick 里点两次：React 的状态更新还没渲染成 disabled，两次 onClick 都会进。
    for (let index = 0; index < 2; index += 1) {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
}

/** 数字卡：靠可见文案定位（页面没有 data 属性），与 her-flows 的做法一致。 */
function statCard(page: Page, label: string): Locator {
  return page.locator('p').filter({ hasText: label }).first().locator('xpath=..');
}

async function statValue(card: Locator): Promise<string> {
  return (await card.locator('span').nth(1).innerText()).replace(/\s+/g, '');
}

/** 页面是否出现横向溢出（超长不可断词最常见的表现）。 */
async function horizontalMetrics(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** 找出把页面撑宽的元素：给报告定位用（取溢出最多的前 4 个）。 */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: { over: number; text: string }[] = [];

    for (const element of Array.from(document.querySelectorAll('body *'))) {
      const over = element.scrollWidth - element.clientWidth;

      if (element.clientWidth > 0 && over > 1) {
        const first = String(element.className ?? '').split(' ')[0];

        found.push({
          over,
          text:
            `${element.tagName.toLowerCase()}${first === '' ? '' : `.${first}`} 内容比容器宽 ${over}px，` +
            `文本「${(element.textContent ?? '').trim().slice(0, 16)}」`,
        });
      }
    }

    return found
      .sort((left, right) => right.over - left.over)
      .slice(0, 4)
      .map((item) => item.text);
  });
}

function addDays(day: { year: number; month: number; day: number }, delta: number): string {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + delta));

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate(),
  ).padStart(2, '0')}`;
}

// ────────────────────────────── A. 多照片 / 多事件组合 ──────────────────────────────

test.describe('审计 A：多张照片、多个事件的组合与二次保存', () => {
  /**
   * 种子之外的组合：一个事件挂 2 张、另一个「待填」事件挂 0 张、第三张照片还没归属。
   * 「没归属的那张」是真实用户路径（先上传、后选事件），也是刚修过的缺陷的**邻居**。
   */
  const MULTI: HerProfile = makeProfile({
    timeline: [
      {
        id: 'audit-e1',
        date: '2026 · 10 · 12',
        iso: '2026-10-12',
        title: '审计事件一',
        photos: ['audit-a.jpg', 'audit-b.jpg'],
      },
      { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: [] },
    ],
    photos: [
      { file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' },
      { file: 'audit-b.jpg', src: MEDIA_SRC, caption: 'B 图注', eventIso: '2026-10-12' },
      { file: 'audit-c.jpg', src: MEDIA_SRC, caption: 'C 图注', eventIso: null },
    ],
  });

  test.beforeEach(() => {
    requireSeeded();
  });

  test('A1 一个事件 2 张 + 后补第 3 张：保存 → 重载 → 再保存，归属不漂移且第二次保存零漂移', async ({
    page,
  }) => {
    await withProfile(MULTI, async () => {
      await openHerForm(page);

      // 前置状态：第一条事件 2 张、第二条事件 0 张、C 还没归属。
      await expect(eventRows(page).nth(0), '第一条事件应显示已挂 2 张').toContainText('已挂 2 张照片');
      await expect(eventRows(page).nth(1), '第二条事件应显示还没有照片').toContainText('还没有照片');
      await expect(page.locator('select[id^="her-photo-event-"]').nth(0)).toHaveValue('audit-e1');
      await expect(page.locator('select[id^="her-photo-event-"]').nth(1)).toHaveValue('audit-e1');
      await expect(
        page.locator('select[id^="her-photo-event-"]').nth(2),
        'C 还没归属，选择框应停在「（还没归到事件）」',
      ).toHaveValue('');

      // 改 B 的图注 + 把 C 挂到第一条事件。
      await page.locator('input[id^="her-photo-caption-"]').nth(1).fill('B 图注（已改）');
      await page.locator('select[id^="her-photo-event-"]').nth(2).selectOption({ label: '审计事件一' });

      await saveOk(page);

      const afterFirst = seededProfile();
      expect(afterFirst.timeline[0]?.photos, '第一条事件现在应挂 3 张，且顺序按照片行').toEqual([
        'audit-a.jpg',
        'audit-b.jpg',
        'audit-c.jpg',
      ]);
      expect(afterFirst.timeline[1]?.photos, '第二条事件不应被塞进照片').toEqual([]);
      expect(afterFirst.photos.find((photo) => photo.file === 'audit-b.jpg')?.caption).toBe(
        'B 图注（已改）',
      );
      expect(
        afterFirst.photos.find((photo) => photo.file === 'audit-c.jpg')?.eventIso,
        'C 挂到有精确日期的事件上以后，eventIso 应被重新派生',
      ).toBe('2026-10-12');

      // 重新加载表单：归属必须还在（照片行按文件名认身份，不靠运行时计数器）。
      await openHerForm(page);
      await expect(eventRows(page).nth(0), '重载后第一条事件应显示已挂 3 张').toContainText(
        '已挂 3 张照片',
      );

      for (const index of [0, 1, 2]) {
        await expect(
          page.locator('select[id^="her-photo-event-"]').nth(index),
          `重载后第 ${index + 1} 张照片的归属应仍是第一条事件`,
        ).toHaveValue('audit-e1');
      }

      // 「保存后不刷新再保存」：同一份内容写两遍，字段不能漂移。
      await saveOk(page);
      const afterSecond = JSON.parse(raw()) as unknown;

      expect(
        afterSecond,
        '同一份内容连续保存两次，写盘结果必须完全一致（不允许字段漂移/丢字段）',
      ).toEqual(afterFirst);

      // 公开页：3 张都在第一条事件这一组里，尾组「还没归到事件里」必须消失。
      await page.goto('/her/photos');
      const e1Group = page.locator('section[aria-labelledby="her-group-audit-e1"]');

      for (const file of ['audit-a.jpg', 'audit-b.jpg', 'audit-c.jpg']) {
        await expect(
          e1Group.locator(`#${photoAnchorId(file)}`),
          `${file} 应出现在「审计事件一」这一组里`,
        ).toBeVisible();
      }

      await expect(
        page.locator('section[aria-labelledby="her-group-her-unassigned"]'),
        '全部照片都有归属后，尾组不应再出现',
      ).toHaveCount(0);

      // 时间线缩略图用 photos[0]，应指向 audit-a.jpg 的锚点。
      // 注意：同一个 href 会出现两次（时间线缩略图 + 主页「最近的照片」），必须限定第一个。
      await page.goto('/her');
      await expect(
        page.locator(`ol a[href="/her/photos#${photoAnchorId('audit-a.jpg')}"]`).first(),
        '时间线缩略图应是这条事件的第一张照片',
      ).toBeVisible();
    });
  });

  test('A2 一张照片在两个事件之间来回改归属：两跳都要求列表与 eventIso 同步', async ({ page }) => {
    const twoEvents = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg', 'audit-b.jpg'],
        },
        { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: [] },
      ],
      photos: [
        { file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' },
        { file: 'audit-b.jpg', src: MEDIA_SRC, caption: 'B 图注', eventIso: '2026-10-12' },
      ],
    });

    await withProfile(twoEvents, async () => {
      // 第一跳：B 从「有日期的事件」改到「待填的事件」。
      await openHerForm(page);
      await page.locator('select[id^="her-photo-event-"]').nth(1).selectOption({ label: '审计事件二待填' });
      await saveOk(page);

      const afterFirst = seededProfile();
      expect(afterFirst.timeline[0]?.photos, '第一跳后 e1 应只剩 A').toEqual(['audit-a.jpg']);
      expect(afterFirst.timeline[1]?.photos, '第一跳后 e2 应拿到 B').toEqual(['audit-b.jpg']);
      expect(
        afterFirst.photos.find((photo) => photo.file === 'audit-b.jpg')?.eventIso,
        '挂到没有精确日期的事件上，eventIso 必须是 null（不是留着旧日期）',
      ).toBeNull();

      // 公开页：B 应该出现在「待填」那一组，而不是留在 e1 组里。
      await page.goto('/her/photos');
      await expect(
        page.locator('section[aria-labelledby="her-group-audit-e2"]').locator(`#${photoAnchorId('audit-b.jpg')}`),
        '改归属后 B 应出现在 e2 这一组',
      ).toBeVisible();
      await expect(
        page.locator('section[aria-labelledby="her-group-audit-e1"]').locator(`#${photoAnchorId('audit-b.jpg')}`),
        'B 不应同时留在 e1 组里',
      ).toHaveCount(0);

      // 第二跳：改回 e1，eventIso 必须被重新派生回日期。
      await openHerForm(page);
      await expect(page.locator('select[id^="her-photo-event-"]').nth(1)).toHaveValue('audit-e2');
      await page.locator('select[id^="her-photo-event-"]').nth(1).selectOption({ label: '审计事件一' });
      await saveOk(page);

      const afterSecond = seededProfile();
      expect(afterSecond.timeline[0]?.photos, '第二跳后 e1 应恢复成 A、B').toEqual([
        'audit-a.jpg',
        'audit-b.jpg',
      ]);
      expect(afterSecond.timeline[1]?.photos, '第二跳后 e2 应变空').toEqual([]);
      expect(
        afterSecond.photos.find((photo) => photo.file === 'audit-b.jpg')?.eventIso,
        '改回有日期的事件后 eventIso 应重新派生',
      ).toBe('2026-10-12');
    });
  });

  test('A3 删除挂着照片的事件：照片不跟着消失、退回未归属，保存被明确拦下；改挂别的事件后能存', async ({
    page,
  }) => {
    const twoEvents = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg'],
        },
        { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: ['audit-b.jpg'] },
      ],
      photos: [
        { file: 'audit-a.jpg', src: MEDIA_SRC, eventIso: '2026-10-12' },
        { file: 'audit-b.jpg', src: MEDIA_SRC, eventIso: null },
      ],
    });

    await withProfile(twoEvents, async () => {
      await openHerForm(page);

      // 删掉第二条事件（它挂着 B）。
      await eventRows(page).nth(1).getByRole('button', { name: '删除' }).click();
      await expect(eventRows(page), '删掉一条事件后应只剩一条').toHaveCount(1);

      // 照片行不能被事件一起带走。
      await expect(photoRows(page), '删事件不应删掉照片行本身').toHaveCount(2);
      await expect(
        page.locator('select[id^="her-photo-event-"]').nth(1),
        '事件没了以后，挂在它上面的照片应退回「（还没归到事件）」',
      ).toHaveValue('');

      // 保存必须被拦下，并给出中文原因（这是刻意的设计，不是缺陷）。
      const blocked = await save(page, 8_000);
      expect(blocked, '存在未归属照片时保存应被拦下并给出中文原因').not.toBeNull();
      expect(blocked ?? '', '拦下的原因应是「没选所属事件」这一类中文说明').toMatch(
        /没选「所属事件」|还没有归到任何事件/,
      );
      // 观察（低，非阻断）：客户端的这条提示只说「还有 1 张」，不点名是哪一张；
      // 用户刚删掉一个挂着多张照片的事件时，得自己回「照片」区里找。服务端那条
      // （src/lib/actions/her.ts:130）是会列文件名的，只是被客户端检查挡在前面没机会说。

      // 改挂到第一条事件后必须能存下来。
      await page.locator('select[id^="her-photo-event-"]').nth(1).selectOption({ label: '审计事件一' });
      await saveOk(page);

      const after = seededProfile();
      expect(after.timeline, '删掉的事件不应复活').toHaveLength(1);
      expect(after.timeline[0]?.photos, '两张照片都应挂到剩下的事件上').toEqual([
        'audit-a.jpg',
        'audit-b.jpg',
      ]);
      expect(after.photos.map((photo) => photo.file).sort()).toEqual(['audit-a.jpg', 'audit-b.jpg']);
    });
  });

  test('A4 同一个 tick 里点两次保存：内容不能被写坏，也不该冒出文件系统错误', async ({ page }) => {
    const single = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg'],
        },
      ],
      photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' }],
    });

    await withProfile(single, async () => {
      await openHerForm(page);
      await page.locator('input[id^="her-photo-caption-"]').first().fill('A 图注（重复提交）');

      // 记 Server Action 的 POST 次数：不数的话，「没有报错」可能只是因为第二次点击
      // 被 disabled 挡住了，根本没收发两个请求 —— 那这条用例就什么都没证明。
      const posts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes('/admin/her')) {
          posts.push(request.url());
        }
      });

      const tempFile = `${HER_DATA_FILE}.tmp`;

      await clickSaveTwiceInOneTick(page);

      await page
        .waitForURL((url) => url.pathname === '/her', { timeout: 25_000 })
        .catch(() => null);
      await page.waitForTimeout(1_500);

      // 无论 UI 怎么表现，文件都必须是完整可解析的一份内容（原子写不该留下半截）。
      const written = JSON.parse(raw()) as HerProfile;
      expect(
        written.photos.find((photo) => photo.file === 'audit-a.jpg')?.caption,
        '重复提交后写盘的内容应是自己填的那一份',
      ).toBe('A 图注（重复提交）');
      expect(existsSync(tempFile), '写完不应留下 .tmp 残留').toBe(false);

      const alert = page.locator('p[role="alert"]').first();
      const alertText = (await alert.count()) > 0 ? (await alert.innerText()).trim() : null;

      // 至少要有一次真的提交出去，否则本用例无意义。
      expect(posts.length, '同一个 tick 的两次点击至少要提交一次 Server Action').toBeGreaterThanOrEqual(1);

      if (posts.length >= 2) {
        expect(
          alertText,
          `两次提交都发出去了，就都必须成功；实际表单提示：${alertText ?? '（无）'}`,
        ).toBeNull();
      }

      console.log(
        `[审计 A4] 一个 tick 内两次点击 → Server Action POST 次数 = ${posts.length}；表单提示 = ${alertText ?? '（无）'}`,
      );
    });
  });

  test('A5 两个标签页同时保存：内容仍可解析，也不能出现文件系统错误', async ({ browser }) => {
    const single = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg'],
        },
      ],
      photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' }],
    });

    await withProfile(single, async () => {
      // 两个独立的浏览器上下文 = 两个互不共享 React 状态的编辑会话（用户开了两个标签页的情形）。
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();

      try {
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await Promise.all([openHerForm(pageA), openHerForm(pageB)]);

        await pageA.locator('#her-display-name').fill('审计-A 标签页');
        await pageB.locator('#her-display-name').fill('审计-B 标签页');

        // 同时按下保存：两个 Server Action 会并发走 saveHerProfile → writeObject，
        // 而 writeObject 用的是固定的 `${target}.tmp` 临时文件名。
        await Promise.all([saveButton(pageA).click(), saveButton(pageB).click()]);

        await pageA.waitForURL((url) => url.pathname === '/her', { timeout: 25_000 }).catch(() => null);
        await pageB.waitForURL((url) => url.pathname === '/her', { timeout: 25_000 }).catch(() => null);
        await pageA.waitForTimeout(1_500);

        // 1) 文件必须始终是完整可解析的一份内容（原子写的目的就在这）。
        const written = JSON.parse(raw()) as HerProfile;
        expect(
          ['审计-A 标签页', '审计-B 标签页'],
          `并发保存后写盘的 displayName 应是两次提交之一，实际：${written.displayName}`,
        ).toContain(written.displayName);

        // 2) 不许留下临时文件。
        expect(existsSync(`${HER_DATA_FILE}.tmp`), '并发写完不应留下 .tmp 残留').toBe(false);

        // 3) 两个标签页都不该看到失败提示（两个请求写的是各自的内容，都应当成功）。
        for (const [label, target] of [
          ['A', pageA],
          ['B', pageB],
        ] as const) {
          const alert = target.locator('p[role="alert"]').first();
          const text = (await alert.count()) > 0 ? (await alert.innerText()).trim() : null;

          expect(text, `标签页 ${label} 不该出现保存失败提示；实际：${text ?? '（无）'}`).toBeNull();
        }
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });
  });
});

// ────────────────────────────── B. 改锚点 id 的连锁 ──────────────────────────────

test.describe('审计 B：改事件锚点 id 的连锁', () => {
  const RENAME_BASE: HerProfile = makeProfile({
    timeline: [
      {
        id: 'audit-e1',
        date: '2026 · 10 · 12',
        iso: '2026-10-12',
        title: '审计事件一',
        photos: ['audit-a.jpg', 'audit-b.jpg'],
      },
      { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: [] },
    ],
    photos: [
      { file: 'audit-a.jpg', src: MEDIA_SRC, eventIso: '2026-10-12' },
      { file: 'audit-b.jpg', src: MEDIA_SRC, eventIso: '2026-10-12' },
    ],
  });

  test.beforeEach(() => {
    requireSeeded();
  });

  test('B1 把 audit-e1 改成 audit-e1-renamed：/her 锚点、照片墙回链都跟新 id，且不留指旧 id 的死链', async ({
    page,
  }) => {
    await withProfile(RENAME_BASE, async () => {
      const errors = collectConsoleErrors(page);

      await openHerForm(page);
      await page.locator('input[id^="her-event-id-"]').first().fill('audit-e1-renamed');
      await saveOk(page);

      // 数据层：id 变了，照片归属必须原样不动。
      const after = seededProfile();
      expect(after.timeline.map((event) => event.id)).toEqual(['audit-e1-renamed', 'audit-e2']);
      expect(after.timeline[0]?.photos, '改 id 不应影响它挂的照片').toEqual([
        'audit-a.jpg',
        'audit-b.jpg',
      ]);

      // /her：锚点跟着新 id，旧 id 不该有元素。
      await page.goto('/her');
      await expect(page.locator('#audit-e1-renamed'), '/her 上应有新 id 的锚点').toBeVisible();
      await expect(page.locator('#audit-e1-renamed')).toContainText('审计事件一');
      await expect(page.locator('#audit-e1'), '/her 上不应再有旧 id 的元素').toHaveCount(0);

      // 照片墙：组标题回链指向新 id，且页面里不许出现旧 id 的链接。
      await page.goto('/her/photos');
      await expect(
        page.locator('a[href="/her#audit-e1-renamed"]').first(),
        '照片墙组标题应回链新 id',
      ).toBeVisible();
      await expect(
        page.locator('a[href="/her#audit-e1"]'),
        '照片墙不应残留指旧 id 的链接（死链）',
      ).toHaveCount(0);

      // 回链真的能用：点过去要落在 new id 的元素上。
      await page.locator('a[href="/her#audit-e1-renamed"]').first().click();
      await expect(page).toHaveURL(/\/her#audit-e1-renamed$/);
      await expect(page.locator('#audit-e1-renamed')).toBeInViewport();

      // 时间线缩略图 → 照片墙锚点这条链不受 id 改名影响。
      // （同一个 href 在时间线与「最近的照片」各有一个，限定在时间线 <ol> 里。）
      await page.goto('/her');
      await expect(
        page.locator(`ol a[href="/her/photos#${photoAnchorId('audit-a.jpg')}"]`).first(),
        '缩略图链接只依赖文件名，不应被事件 id 改名影响',
      ).toBeVisible();

      await page.goto('/her/photos');
      await expect(page.locator(`#${photoAnchorId('audit-a.jpg')}`)).toBeVisible();

      expectNoPageErrors(errors);
    });
  });

  test('B2 锚点 id 填了非法值（大写与空格）：整份拒绝保存，磁盘内容不动', async ({ page }) => {
    await withProfile(RENAME_BASE, async () => {
      const before = raw();

      await openHerForm(page);
      await page.locator('input[id^="her-event-id-"]').first().fill('Bad ID');

      const error = await save(page, 10_000);

      expect(error, '非法锚点 id 应被拒绝保存并给出原因').not.toBeNull();
      expect(error ?? '', '原因里应提到 id / 锚点').toMatch(/id|锚点/);
      expect(raw(), '保存被拒时磁盘内容必须一个字节都不变').toBe(before);
    });
  });
});

// ────────────────────────────── C. 空与极值 ──────────────────────────────

test.describe('审计 C：空与极值', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('C1 删光所有事件只剩照片：照片出现在尾组，三页都正常', async ({ page }) => {
    const seedRaw = raw();
    const seed = JSON.parse(seedRaw) as HerProfile;

    test.skip(
      seed.photos.length === 0 || seed.timeline.length === 0,
      '种子需要「有事件 + 有照片」才能验「删光事件」这一组合',
    );

    await withRawFile(seedRaw, async () => {
      const errors = collectConsoleErrors(page);

      await openHerForm(page);

      // 逐条删掉全部事件（每次删第一行）。
      while ((await eventRows(page).count()) > 0) {
        await eventRows(page).first().getByRole('button', { name: '删除' }).click();
      }

      await expect(eventRows(page), '全部事件都删掉后表单里不应还有事件行').toHaveCount(0);

      // timeline 为空时允许先存照片（schema 与引用检查都刻意留了这条路）。
      await saveOk(page);

      const after = seededProfile();
      expect(after.timeline, '存下来以后事件应当是空的').toEqual([]);
      expect(after.photos.length, '照片不能因为删事件而消失').toBe(seed.photos.length);

      // /her：时间线走空状态；照片入口仍在。
      await page.goto('/her');
      await expect(page.getByText('还没有写下任何事件'), '/her 应显示时间线空状态').toBeVisible();

      // /her/photos：照片全部落在「还没归到事件里」尾组里，且计数按渲染数。
      await page.goto('/her/photos');
      const tail = page.locator('section[aria-labelledby="her-group-her-unassigned"]');
      await expect(tail, '删光事件后应出现未归属尾组').toBeVisible();

      for (const photo of after.photos) {
        await expect(
          tail.locator(`#${photoAnchorId(photo.file)}`),
          `${photo.file} 应出现在尾组里（不能被静默丢掉）`,
        ).toBeVisible();
      }

      await expect(page.getByText(`共 ${after.photos.length} 张`)).toBeVisible();

      expectNoPageErrors(errors);
    });
  });

  test('C2 删光所有照片：时间线显示待补，照片墙空状态，主页「全部 N 张」入口消失', async ({
    page,
  }) => {
    const seedRaw = raw();
    const seed = JSON.parse(seedRaw) as HerProfile;

    test.skip(seed.photos.length === 0, '种子需要先有照片，才能验「删光照片」');

    await withRawFile(seedRaw, async () => {
      const errors = collectConsoleErrors(page);
      const withPhotos = seed.timeline.filter((event) => (event.photos ?? []).length > 0);

      test.skip(withPhotos.length === 0, '种子里没有挂照片的事件，删光照片后没有可断言的时间线缩略图');

      await openHerForm(page);

      while ((await photoRows(page).count()) > 0) {
        await photoRows(page).first().getByRole('button', { name: '删除' }).click();
      }

      await expect(photoRows(page), '删光照片后表单里不应还有照片行').toHaveCount(0);
      await saveOk(page);

      const after = seededProfile();
      expect(after.photos, '存下来以后 photos 应当是空的').toEqual([]);
      expect(
        after.timeline.every((event) => (event.photos ?? []).length === 0),
        '事件里的 photos 引用也应一并清空（不能留下指向已删照片的文件名）',
      ).toBe(true);

      // /her：原来挂照片的事件改画「待补」空位，不出现破图。
      await page.goto('/her');
      const first = withPhotos[0];

      if (first !== undefined) {
        const item = page.locator(`#${first.id}`);
        await expect(item).toContainText('待补');
        await expect(item.locator('img'), '没有照片的事件不应渲染 <img>').toHaveCount(0);
      }

      // /her：照片入口不该再出现「全部 N 张 →」。
      await expect(page.getByRole('link', { name: /全部 \d+ 张/ }), '照片为 0 时主页不应有「全部 N 张」入口').toHaveCount(0);

      // /her/photos：空状态。
      await page.goto('/her/photos');
      await expect(page.getByText('还没有照片')).toBeVisible();

      expectNoPageErrors(errors);
    });
  });

  test('C3 信里只填引用、不填正文：应渲染引用块，而不是「这封信还没写完」', async ({ page }) => {
    const quoteOnly = makeProfile({
      timeline: [{ id: 'audit-e1', date: null, iso: null, title: '审计事件一', photos: [] }],
      photos: [],
      letter: { salutation: '审计称呼：', paragraphs: [], quote: '审计引用句' },
    });

    await withProfile(quoteOnly, async () => {
      await page.goto('/her/letter');

      await expect(page.locator('blockquote'), '只有引用时也应渲染引用块').toContainText('审计引用句');
      await expect(
        page.getByText('这封信还没写完'),
        '有引用就不算空信，不该显示空状态',
      ).toHaveCount(0);
      await expect(page.locator('.rich-text p').first()).toContainText('审计称呼：');
    });
  });

  test('C4 称呼首尾带空格：保存后被去掉，公开页不留可见空白', async ({ page }) => {
    const seedRaw = raw();

    await withRawFile(seedRaw, async () => {
      await openHerForm(page);

      await page.getByRole('button', { name: '+ 加一段' }).click();
      await page.getByRole('textbox', { name: '第 1 段' }).fill('审计空格测试段落。');
      await page.locator('#her-letter-salutation').fill('   审计称呼带空格：   ');

      await saveOk(page);

      const after = seededProfile();
      expect(after.letter.salutation, '称呼写盘时必须去掉首尾空格').toBe('审计称呼带空格：');

      await page.goto('/her/letter');
      const firstParagraph = page.locator('.rich-text p').first();
      expect(await firstParagraph.innerText(), '页面上的称呼不应带首尾空格').toBe('审计称呼带空格：');
    });
  });

  test('C5 纪念日填未来日期：显示「距离在一起纪念日」与正数，不出现负数', async ({ page }) => {
    const today = todayInTimeZone();
    const future = addDays(today, 45);
    const expected = daysTogether(today, future);

    expect(expected, `${future} 应是合法日期`).not.toBeNull();
    expect(expected!, '前置条件：未来日期算出来必须是负数（否则这条用例测不到未来分支）').toBeLessThan(0);

    const futureSince = makeProfile({
      timeline: [{ id: 'audit-e1', date: null, iso: null, title: '审计事件一', photos: [] }],
      photos: [],
      since: future,
    });

    await withProfile(futureSince, async () => {
      await page.goto('/her');

      const card = statCard(page, '距离在一起纪念日');
      await expect(card, '纪念日还没到时，卡片应写明「距离在一起纪念日」').toBeVisible();

      const value = await statValue(card);
      expect(value, `卡片主值应是正数 ${Math.abs(expected!)}，实际「${value}」`).toBe(
        String(Math.abs(expected!)),
      );
      expect(value, '未来日期不允许显示负数').not.toMatch(/^-/);
    });
  });

  test('C6 生日填 2-29：卡片写的「下一次落在…」必须与倒计时真的落点一致', async ({ page }) => {
    const today = todayInTimeZone();
    const birthday = { month: 2, day: 29 };
    const summary = describeBirthday(today, birthday);
    const landing = occurrenceOf(summary.nextOccurrenceYear, birthday);
    const expectedNote = `下一次落在 ${landing.year} 年 ${landing.month} 月 ${landing.day} 日`;

    const leapBirthday = makeProfile({
      timeline: [{ id: 'audit-e1', date: null, iso: null, title: '审计事件一', photos: [] }],
      photos: [],
      birthday,
    });

    await withProfile(leapBirthday, async () => {
      await page.goto('/her');

      const card = statCard(page, '生日');

      if (summary.isToday) {
        await expect(card).toContainText('今天');
        return;
      }

      expect(
        await statValue(card),
        `倒计时应与 describeBirthday 同源（${summary.daysUntil} 天）`,
      ).toBe(String(summary.daysUntil));

      // describeBirthday 自己把 2-29 在平年收拢到 2-28（见 src/lib/date/birthday.ts 顶部说明），
      // 卡片文案必须说同一个落点，不能写一个不存在的日期。
      await expect(
        card,
        `倒计时落在 ${landing.year}-${landing.month}-${landing.day}，卡片文案就必须写这个日子；` +
          '平年写成 2 月 29 日等于告诉用户一个不存在的日期',
      ).toContainText(expectedNote);
    });
  });

  test('C7 建页日填未来日期：保存被拦下并给出中文原因，数据不被写脏', async ({ page }) => {
    const today = todayInTimeZone();
    const future = addDays(today, 45);

    const seedRaw = raw();

    await withRawFile(seedRaw, async () => {
      await openHerForm(page);
      await page.locator('#her-built-on').fill(future);
      await page.click('button:has-text("保存并查看 /her")');
      await page.waitForTimeout(3_000);

      // 修复后的行为（Lead 2026-10-12）：后台直接拒绝未来日期，而不是让它存进去再在页面上显示负数。
      // 因此在表单上就说清楚，并且一个字节都不写盘。
      const alerts = (await page.locator('p[role="alert"]').allTextContents())
        .map((t) => t.trim())
        .filter((t) => t !== '');

      expect(
        alerts.join(' ｜ '),
        '建页日在未来时应当被拦下，并给出中文原因（否则公开页会出现「-45 天」）',
      ).toContain('未来的日期');

      const after = seededProfile();
      expect(after.pageBuiltOn, '被拦下的保存不能改动 data/her.json 的建页日').not.toBe(future);

      await page.goto('/her');
      const value = await statValue(statCard(page, '站在这页上的时间'));
      expect(value, `建页日仍在过去，这张卡不该出现负数；实际「${value}」`).not.toMatch(/^-/);
    });
  });
});

// ────────────────────────────── D. 公开页健壮性 ──────────────────────────────

test.describe('审计 D：公开页健壮性', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('D1 事件名/图注/正文里的 HTML 与脚本片段：原样显示为文本，不执行', async ({ page }) => {
    const imgPayload = '<img src=x onerror="window.__auditXss=1">';
    const scriptPayload = '<script>window.__auditXss=2</script>';
    const titlePayload = '<b>审计粗体</b><img src=x onerror="window.__auditXss=3">';
    const captionPayload = '<u>审计下划线</u>';
    const taglinePayload = '<i>审计斜体</i>';

    const xssProfile = makeProfile({
      tagline: taglinePayload,
      timeline: [
        {
          id: 'audit-e1',
          date: null,
          iso: null,
          title: titlePayload,
          photos: ['audit-a.jpg'],
        },
      ],
      photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: captionPayload }],
      letter: { salutation: '审计称呼：', paragraphs: [imgPayload, scriptPayload] },
    });

    await withProfile(xssProfile, async () => {
      for (const route of ['/her', '/her/photos', '/her/letter']) {
        await page.goto(route);

        expect(
          await page.evaluate(() => (window as unknown as Record<string, unknown>).__auditXss),
          `${route} 上注入的 onerror 不应执行`,
        ).toBeUndefined();

        expect(
          await page.locator('img[src="x"]').count(),
          `${route} 不应真的插入 <img src=x> 元素`,
        ).toBe(0);

        expect(
          await page.locator('script:has-text("__auditXss")').count(),
          `${route} 不应出现被当成脚本执行的文本`,
        ).toBe(0);
      }

      // 事件名按文本渲染（标签不能变成元素）。
      await page.goto('/her');
      const heading = page.locator('h3', { hasText: titlePayload });
      await expect(heading, '事件名里的标签应原样显示为文本').toBeVisible();
      await expect(heading.locator('b'), '事件名里的 <b> 不应变成真元素').toHaveCount(0);

      // 信正文按文本渲染。
      await page.goto('/her/letter');
      const imgParagraph = page.locator('.rich-text p', { hasText: imgPayload });
      await expect(imgParagraph, '正文里的 HTML 片段应原样显示').toBeVisible();
      expect(await imgParagraph.innerText(), '段落文本应与写入的完全一致').toBe(imgPayload);
      await expect(page.locator('.rich-text p', { hasText: scriptPayload })).toBeVisible();
    });
  });

  test('D2 超长且不可断行的文本：390px 与 1280px 都不应产生横向滚动', async ({ page }) => {
    const longTitle = 'A'.repeat(120);
    const longCaption = 'B'.repeat(500);
    const longParagraph = 'C'.repeat(4000);
    const longTagline = 'D'.repeat(200);

    const base = {
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg'],
        },
      ],
      photos: [{ file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' }],
    } satisfies ProfileOptions;

    // 一次只放一个超长字段，才能把「哪一页被哪一处撑破」说清楚。
    const variants: { label: string; profile: HerProfile; routes: string[] }[] = [
      {
        label: '只有 120 字不可断行的事件名',
        profile: makeProfile({
          ...base,
          timeline: [{ ...base.timeline[0]!, title: longTitle }],
        }),
        routes: ['/her', '/her/photos'],
      },
      {
        label: '只有 500 字不可断行的图注',
        profile: makeProfile({
          ...base,
          photos: [{ ...base.photos[0]!, caption: longCaption }],
        }),
        routes: ['/her/photos'],
      },
      {
        label: '只有 200 字不可断行的副标题',
        profile: makeProfile({ ...base, tagline: longTagline }),
        routes: ['/her'],
      },
      {
        label: '只有 4000 字不可断行的信正文',
        profile: makeProfile({
          ...base,
          letter: { salutation: '审计称呼：', paragraphs: [longParagraph] },
        }),
        routes: ['/her/letter'],
      },
    ];

    await withRawFile(raw(), async () => {
      const failing: string[] = [];
      const measured: string[] = [];

      for (const variant of variants) {
        writeFileSync(HER_DATA_FILE, `${JSON.stringify(variant.profile, null, 2)}\n`, 'utf8');

        for (const viewport of [
          { width: 390, height: 844 },
          { width: 1280, height: 800 },
        ]) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });

          for (const route of variant.routes) {
            await page.goto(route);

            const metrics = await horizontalMetrics(page);
            const line = `${variant.label} → ${route} @${viewport.width}px: scrollWidth=${metrics.scrollWidth} / clientWidth=${metrics.clientWidth}`;

            measured.push(line);

            if (metrics.scrollWidth > metrics.clientWidth + 1) {
              failing.push(`${line}；溢出元素：${(await overflowingElements(page)).join(' ｜ ') || '（未定位到）'}`);
            }
          }
        }
      }

      // soft：让每个组合的实测数字都在同一条消息里报出来，而不是第一个红掉就看不到后面。
      expect
        .soft(
          failing,
          `以下组合出现横向滚动（页面级 scrollWidth 超出视口）：\n${failing.join('\n')}\n\n` +
            `全部实测：\n${measured.join('\n')}`,
        )
        .toHaveLength(0);
    });
  });
});

// ────────────────────────────── E. 查看器边界 ──────────────────────────────

test.describe('审计 E：照片查看器边界', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  test('E1 只有 1 张照片：左右键不越界，始终停在 1 / 1', async ({ page }) => {
    // 自带「正好 1 张照片」的数据：不依赖种子，也不会因为别的 spec 留下照片而被 skip。
    await withProfile(FIXTURE_ONE_PHOTO, async () => {
      const anchor = photoAnchorId('audit-a.jpg');

      await page.goto('/her/photos');
      await page.locator(`#${anchor}`).getByRole('button', { name: /放大查看/ }).first().click();

      const dialog = page.getByRole('dialog', { name: '照片查看器' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('1 / 1', { exact: true })).toBeVisible();

      const sourceBefore = await dialog.locator('img').first().getAttribute('src');

      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft']) {
        await page.keyboard.press(key);
        await expect(
          dialog.getByText('1 / 1', { exact: true }),
          `按 ${key} 后仍应停在 1 / 1（只有一张）`,
        ).toBeVisible();
      }

      expect(await dialog.locator('img').first().getAttribute('src'), '单张时图片不应变化').toBe(
        sourceBefore,
      );
    });
  });

  test('E2 多组之间切换：序号与内容同步，首尾循环不越界', async ({ page }) => {
    const threePhotos = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['audit-a.jpg', 'audit-b.jpg'],
        },
        { id: 'audit-e2', date: null, iso: null, title: '审计事件二待填', photos: [] },
      ],
      photos: [
        { file: 'audit-a.jpg', src: MEDIA_SRC, caption: 'A 图注', eventIso: '2026-10-12' },
        { file: 'audit-b.jpg', src: MEDIA_SRC, caption: 'B 图注', eventIso: '2026-10-12' },
        // 未归属的第三张：它属于尾组，用来验「跨组切换」。
        { file: 'audit-c.jpg', src: MEDIA_SRC, caption: 'C 图注', eventIso: null },
      ],
    });

    await withProfile(threePhotos, async () => {
      await page.goto('/her/photos');
      await page
        .locator(`#${photoAnchorId('audit-a.jpg')}`)
        .getByRole('button', { name: /放大查看/ })
        .first()
        .click();

      const dialog = page.getByRole('dialog', { name: '照片查看器' });
      const next = dialog.getByRole('button', { name: '下一张照片' });
      const prev = dialog.getByRole('button', { name: '上一张照片' });

      await expect(dialog.getByText('1 / 3', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('A 图注');

      // 跨到同一组的第二张。
      await next.click();
      await expect(dialog.getByText('2 / 3', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('B 图注');

      // 跨到下一组（未归属尾组）的第三张。
      await next.click();
      await expect(dialog.getByText('3 / 3', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('C 图注');
      await expect(
        dialog.getByText('2026 年 10 月 12 日'),
        '尾组的照片没有所属事件，查看器不应残留上一张的事件行',
      ).toHaveCount(0);

      // 末尾再点一次：循环回第一张（不能停住、也不能越界成 4 / 3）。
      await next.click();
      await expect(dialog.getByText('1 / 3', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('A 图注');

      // 第一张往前：循环到最后一张。
      await prev.click();
      await expect(dialog.getByText('3 / 3', { exact: true })).toBeVisible();

      expect(
        await dialog.getByText(/^\d+ \/ \d+$/).count(),
        '查看器里的序号不能出现越界值或重复',
      ).toBe(1);
    });
  });

  test('E3 打开后连按 Tab / Shift+Tab：焦点始终锁在查看器里', async ({ page }) => {
    const seed = seededProfile();

    test.skip(seed.photos.length === 0, '种子没有照片，查看器打不开');

    const anchor = photoAnchorId(seed.photos[0]!.file);

    await page.goto('/her/photos');
    await page.locator(`#${anchor}`).getByRole('button', { name: /放大查看/ }).first().click();

    const dialog = page.getByRole('dialog', { name: '照片查看器' });
    await expect(dialog).toBeVisible();

    const focusState = async (): Promise<{ inside: boolean; label: string }> =>
      page.evaluate(() => {
        const active = document.activeElement;
        const panel = document.querySelector('[role="dialog"][aria-label="照片查看器"]');

        return {
          inside: active !== null && panel !== null && panel.contains(active),
          label:
            active === null
              ? '（无）'
              : (active.getAttribute('aria-label') ??
                (active.textContent ?? '').trim().slice(0, 20) ??
                active.tagName),
        };
      });

    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      const state = await focusState();

      expect(
        state.inside,
        `第 ${index + 1} 次 Tab 之后焦点跑出了查看器（落点：${state.label}）`,
      ).toBe(true);
    }

    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Shift+Tab');
      const state = await focusState();

      expect(
        state.inside,
        `第 ${index + 1} 次 Shift+Tab 之后焦点跑出了查看器（落点：${state.label}）`,
      ).toBe(true);
    }

    // Esc 仍然能关，且焦点回到打开它的按钮上。
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

// ────────────────────────────── F. 后台表单的行身份 ──────────────────────────────

test.describe('审计 F：后台表单的行身份（缺陷邻近场景）', () => {
  test.beforeEach(() => {
    requireSeeded();
  });

  /**
   * 造出「两行共用同一个 React key」的状态：加一行 → 删掉一条**原有**行 → 再加一行。
   *
   * 成因（`her-form.tsx`）：新行的 key 是 `new-event-<当前行数>` / `slot-<当前照片行数>`，
   * 由**当前数组长度**派生；长度被删回原值以后再新增，key 就与上一次新增的那行撞车。
   * React 的 key 同时是 `patchTimeline` / `patchPhoto` / `removeEvent` / `removePhoto`
   * 的匹配依据，撞车 = 两行被当成同一行。
   */
  async function makeEventKeyCollision(page: Page): Promise<number> {
    const before = await eventRows(page).count();

    await page.getByRole('button', { name: '+ 加一条' }).click();
    await expect(eventRows(page)).toHaveCount(before + 1);

    await eventRows(page).nth(1).getByRole('button', { name: '删除' }).click();
    await expect(eventRows(page)).toHaveCount(before);

    await page.getByRole('button', { name: '+ 加一条' }).click();
    await expect(eventRows(page)).toHaveCount(before + 1);

    return before;
  }

  async function makePhotoKeyCollision(page: Page): Promise<number> {
    const before = await photoRows(page).count();

    await page.getByRole('button', { name: '+ 加一张' }).click();
    await expect(photoRows(page)).toHaveCount(before + 1);

    // 删掉原来那张（真实用户「换一张照片」的路径）。
    await photoRows(page).first().getByRole('button', { name: '删除' }).click();
    await expect(photoRows(page)).toHaveCount(before);

    await page.getByRole('button', { name: '+ 加一张' }).click();
    await expect(photoRows(page)).toHaveCount(before + 1);

    return before;
  }

  test('F1a 事件的 key 撞车：改一行的标题会同时改到另一行', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await withProfile(FIXTURE_TWO_EVENTS, async () => {
      await openHerForm(page);
      await expect(eventRows(page)).toHaveCount(2);

      await makeEventKeyCollision(page);

      const titleInputs = page.locator('input[id^="her-event-title-"]');
      const count = await titleInputs.count();

      const valuesBefore = await titleInputs.evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );

      await titleInputs.nth(count - 2).fill('审计-倒数第二行');

      const valuesAfter = await titleInputs.evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
      const changed = valuesAfter.filter((value, index) => value !== valuesBefore[index]).length;

      expect(
        changed,
        `改一行只应影响一行，实际影响了 ${changed} 行。` +
          `两次写入后表单里的值：${JSON.stringify(valuesAfter)}。` +
          '原因：新增的事件行 key 是 `new-event-<当前行数>`，删一条再加一条会与上一次新增的行重名，' +
          'patchTimeline 按 key 匹配会把两行一起改。',
      ).toBe(1);

      const keyErrors = [...errors.consoleErrors, ...errors.pageErrors].filter((text) =>
        /same key|unique "key"|重复的 key/i.test(text),
      );

      expect(
        keyErrors,
        `表单不应渲染重复 key 的行；React 报错原文：\n${keyErrors.join('\n---\n')}`,
      ).toHaveLength(0);
    });
  });

  test('F1b 事件的字段 id 撞车：同一页出现两个相同的 DOM id', async ({ page }) => {
    await withProfile(FIXTURE_TWO_EVENTS, async () => {
      await openHerForm(page);
      await expect(eventRows(page)).toHaveCount(2);

      await makeEventKeyCollision(page);

      const ids = await page
        .locator('input[id^="her-event-title-"]')
        .evaluateAll((inputs) => inputs.map((input) => input.id));

      expect(
        new Set(ids).size,
        `事件行的字段 id 必须唯一；实际：${ids.join('、')}。` +
          '重复的 DOM id 会让 label/for 指向第一行（点第二行的标签会跳到第一行的输入框），' +
          '也会让 getByLabel / a11y 工具认错控件。',
      ).toBe(ids.length);
    });
  });

  test('F1c 事件的 key 撞车：删掉一行会连带删掉另一行', async ({ page }) => {
    await withProfile(FIXTURE_TWO_EVENTS, async () => {
      await openHerForm(page);
      await expect(eventRows(page)).toHaveCount(2);

      await makeEventKeyCollision(page);

      const count = await eventRows(page).count();
      await eventRows(page).nth(count - 2).getByRole('button', { name: '删除' }).click();

      await expect(
        eventRows(page),
        `点了 1 次「删除」：行数应从 ${count} 变成 ${count - 1}；` +
          '如果掉到更少，说明 removeEvent 按 key 匹配，把另一行也删掉了。',
      ).toHaveCount(count - 1);
    });
  });

  test('F2a 照片的 key 撞车：改一行的图注会同时改到另一行', async ({ page }) => {
    await withProfile(FIXTURE_ONE_PHOTO, async () => {
      await openHerForm(page);
      await expect(photoRows(page)).toHaveCount(1);

      await makePhotoKeyCollision(page);

      const captionInputs = page.locator('input[id^="her-photo-caption-"]');

      await captionInputs.nth(0).fill('审计-第一行图注');

      const values = await captionInputs.evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
      const changed = values.filter((value) => value === '审计-第一行图注').length;

      expect(
        changed,
        `改一张照片的图注只应影响一行，实际有 ${changed} 行都变成了「审计-第一行图注」：` +
          `${JSON.stringify(values)}。` +
          '原因：新增照片行的 key 是 `slot-<当前照片行数>`，删一张再加一张会与上一次新增的行重名。',
      ).toBe(1);
    });
  });

  test('F2b 照片的字段 id 撞车：同一页出现两个相同的 DOM id', async ({ page }) => {
    await withProfile(FIXTURE_ONE_PHOTO, async () => {
      await openHerForm(page);
      await expect(photoRows(page)).toHaveCount(1);

      await makePhotoKeyCollision(page);

      const ids = await page
        .locator('input[id^="her-photo-caption-"]')
        .evaluateAll((inputs) => inputs.map((input) => input.id));

      expect(
        new Set(ids).size,
        `照片行的字段 id 必须唯一；实际：${ids.join('、')}`,
      ).toBe(ids.length);
    });
  });

  test('F2c 照片的 key 撞车：删掉一张会连带删掉另一张', async ({ page }) => {
    await withProfile(FIXTURE_ONE_PHOTO, async () => {
      await openHerForm(page);
      await expect(photoRows(page)).toHaveCount(1);

      await makePhotoKeyCollision(page);

      const count = await photoRows(page).count();
      await photoRows(page).nth(count - 1).getByRole('button', { name: '删除' }).click();

      await expect(
        photoRows(page),
        `点了 1 次「删除」：照片行应从 ${count} 变成 ${count - 1}；` +
          '如果掉到更少，说明 removePhoto 按 key 匹配，把另一张也删掉了。',
      ).toHaveCount(count - 1);
    });
  });

  test('F3a 照片行 key 与文件名撞车：删掉新增的空行会连带删掉真实照片行', async ({ page }) => {
    // 撞车的成因：新增行的 key 是 `slot-<当前照片行数>`。
    // 只要已有一行的 key 正好等于这个值（文件名就叫 slot-1，或先加行/删行把长度对上），
    // 两行就共用同一个 key，removePhoto/patchPhoto 按 key 匹配会同时命中两行。
    const colliding = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['slot-1'],
        },
      ],
      photos: [{ file: 'slot-1', src: MEDIA_SRC, caption: '这是真实照片', eventIso: '2026-10-12' }],
    });

    await withProfile(colliding, async () => {
      await openHerForm(page);

      await expect(photoRows(page), '前置：只有一张真实照片').toHaveCount(1);
      await expect(page.locator('input[id^="her-photo-caption-"]').first()).toHaveValue('这是真实照片');

      // 用户点「+ 加一张」：新行的 key 与已有行的 key 都是 `slot-1`。
      await page.getByRole('button', { name: '+ 加一张' }).click();
      await expect(photoRows(page)).toHaveCount(2);

      // 用户删掉刚加的那张空行（第二行）。
      await photoRows(page).nth(1).getByRole('button', { name: '删除' }).click();

      await expect(
        photoRows(page),
        '删掉新增的空行后，真实照片那一行必须还在（照片行应从 2 变成 1）；' +
          '它一起消失说明两行共用了同一个 key。',
      ).toHaveCount(1);
    });
  });

  test('F3b 同一撞车的后果：保存后真实照片从数据与公开页一起消失', async ({ page }) => {
    const colliding = makeProfile({
      timeline: [
        {
          id: 'audit-e1',
          date: '2026 · 10 · 12',
          iso: '2026-10-12',
          title: '审计事件一',
          photos: ['slot-1'],
        },
      ],
      photos: [{ file: 'slot-1', src: MEDIA_SRC, caption: '这是真实照片', eventIso: '2026-10-12' }],
    });

    await withProfile(colliding, async () => {
      await openHerForm(page);

      await page.getByRole('button', { name: '+ 加一张' }).click();
      await expect(photoRows(page)).toHaveCount(2);
      await photoRows(page).nth(1).getByRole('button', { name: '删除' }).click();

      // 用 soft：让两条后果都留下证据，不要在第一条就中断。
      await saveOk(page);

      const after = seededProfile();
      expect.soft(
        after.photos.map((photo) => photo.file),
        `磁盘上必须还留着那张真实照片；实际写盘内容：${raw().replace(/\s+/g, '')}`,
      ).toEqual(['slot-1']);

      expect.soft(
        after.timeline[0]?.photos,
        '事件也必须还引用着这张照片（删事件不该连带删照片的归属）',
      ).toEqual(['slot-1']);

      await page.goto('/her/photos');
      await expect
        .soft(
          page.locator(`#${photoAnchorId('slot-1')}`),
          '公开页照片墙上必须还能看到这张照片',
        )
        .toBeVisible();
    });
  });
});
