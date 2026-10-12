import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DATE_PLACEHOLDER,
  PHOTO_DIR,
  eventOfPhoto,
  eventPhotoFiles,
  herProfile,
  isLetterEmpty,
  photoGroups,
  photoSrc,
  photosForEvent,
  recentPhotoEntries,
  unassignedPhotos,
  type HerEvent,
  type HerPhoto,
  type HerProfile,
} from '@/content/her';
import { daysTogether, parseIsoDate } from '@/lib/date';

/**
 * 站内照片最终落在 public/ 下（`/media/her/2026-10-12-01.jpg` → `public/media/her/2026-10-12-01.jpg`）。
 * 现在里面有一张占位图 2026-10-12-01.jpg；换成真照片时文件名要一起改这里的数据。
 */
const PUBLIC_ROOT = path.join(process.cwd(), 'public');

/**
 * `herProfile` 被 `as const` 收窄成字面量类型：没填的可选字段（note / caption / quote / signature）
 * 不会出现在类型上，直接访问会编译不过。测试要按契约类型检查可选字段，所以过一道类型视图；
 * 对象本身还是同一份数据，没有复制。
 */
const timeline: readonly HerEvent[] = herProfile.timeline;
const photos: readonly HerPhoto[] = herProfile.photos;
const letter: HerProfile['letter'] = herProfile.letter;

/** 取第一项，空数组直接报错（比一堆 `as NonNullable<...>` 干净）。 */
function first<T>(items: readonly T[]): T {
  const [item] = items;

  if (item === undefined) {
    throw new Error('期望至少有一项，实际是空的');
  }

  return item;
}

function firstEventWithId(id: string): HerEvent {
  const event = timeline.find((candidate) => candidate.id === id);

  if (event === undefined) {
    throw new Error(`时间线里没有 id 为 ${id} 的事件`);
  }

  return event;
}

/** 递归找出值为 undefined 的字段路径（JSON.stringify 会把它们悄悄丢掉，所以单独查一遍）。 */
function undefinedPaths(value: unknown, prefix = 'herProfile'): string[] {
  if (value === undefined) {
    return [prefix];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => undefinedPaths(item, `${prefix}[${index}]`));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => undefinedPaths(item, `${prefix}.${key}`));
  }

  return [];
}

/**
 * 一份用来验证绑定逻辑本身的测试数据（不是页面内容）：
 * 乙事件挂两张（含重复项）、甲事件不填 eventIso 挂一张、丙事件没有照片、外加一张没人引用的孤儿照片。
 */
const fixture: HerProfile = {
  slug: 'her',
  displayName: '测试昵称',
  tagline: '测试用',
  birthday: { month: 1, day: 1 },
  since: '2026-01-01',
  pageBuiltOn: '2026-01-01',
  heroYear: '2026',
  timeline: [
    {
      id: 'b',
      date: '2026 · 02 · 02',
      iso: '2026-02-02',
      title: '事件乙',
      photos: ['b-2.jpg', 'b-1.jpg', 'b-1.jpg'],
    },
    { id: 'a', date: null, iso: null, title: '事件甲', photos: ['a-1.jpg'] },
    { id: 'c', date: null, iso: null, title: '事件丙' },
  ],
  photos: [
    { file: 'b-1.jpg', eventIso: '2026-02-02' },
    { file: 'b-2.jpg', eventIso: '2026-02-02' },
    { file: 'a-1.jpg' },
    { file: 'orphan.jpg' },
  ],
  letter: { salutation: '测试：', paragraphs: ['第一段'] },
};

describe('herProfile · 身份与隐私', () => {
  it('只放昵称占位，不放真名：称呼非空、无空格、不带 @', () => {
    expect(herProfile.slug).toBe('her');
    expect(herProfile.displayName.trim()).not.toBe('');
    expect(herProfile.displayName).not.toMatch(/\s/);
    expect(herProfile.displayName).not.toContain('@');
  });

  it('副标题有内容（Hero 那一行不能是空的）', () => {
    expect(herProfile.tagline.trim()).not.toBe('');
  });

  it('序列化后不出现学校、联系方式一类私人信息', () => {
    const serialized = JSON.stringify(herProfile);

    expect(serialized).not.toMatch(/@|\d{11}|微信|QQ|身份证|手机号|学校|大学|中学|家庭住址/);
  });
});

describe('herProfile · 生日与纪念日', () => {
  it('生日是 10 月 11 日（month 从 1 开始）', () => {
    expect(herProfile.birthday).toEqual({ month: 10, day: 11 });
  });

  it('纪念日只能是 null 或合法 YYYY-MM-DD，不允许写「待填」这类字符串', () => {
    const since = herProfile.since;

    if (since !== null) {
      expect(parseIsoDate(since)).not.toBeNull();
    }
  });

  it('纪念日当前已填：小泽确认的 2025 年 12 月 13 日', () => {
    expect(herProfile.since).toBe('2025-12-13');
    expect(parseIsoDate(herProfile.since)).not.toBeNull();
  });

  it('「已走过 N 天」算得出来且方向正确：2026-10-12 起算是 303 天，不是负数', () => {
    const days = daysTogether({ year: 2026, month: 10, day: 12 }, herProfile.since);

    expect(days).toBe(303);
    expect(days).toBeGreaterThan(0);
  });

  it('建页日是合法日期，而且就是时间线里那条真实日期的出处', () => {
    expect(parseIsoDate(herProfile.pageBuiltOn)).not.toBeNull();

    const builtEvents = timeline.filter((event) => event.iso === herProfile.pageBuiltOn);

    expect(builtEvents).toHaveLength(1);
  });

  it('Hero 上的年份与建页日同一年，不许各写一份还写不一样', () => {
    expect(herProfile.heroYear).toBe(herProfile.pageBuiltOn.slice(0, 4));
  });

  it('「待填」的文案只有一处（三个页面共用 DATE_PLACEHOLDER）', () => {
    expect(DATE_PLACEHOLDER.trim()).not.toBe('');
  });
});

describe('herProfile · 大事记', () => {
  it('至少 3 条', () => {
    expect(timeline.length).toBeGreaterThanOrEqual(3);
  });

  it('条目数与「已填日期」数量对得上：2 条已填、1 条待填', () => {
    const filled = timeline.filter((event) => event.iso !== null);
    const pending = timeline.filter((event) => event.iso === null);

    expect(timeline).toHaveLength(3);
    expect(filled.map((event) => event.iso)).toEqual(['2026-10-12', '2025-12-13']);
    expect(pending.map((event) => event.id)).toEqual(['first-meeting']);
  });

  it('纪念日 since 与「在一起那天」是同一天，两处不许不一致', () => {
    const together = timeline.find((event) => event.id === 'together');

    expect(together).toBeDefined();
    expect(together?.date).toBe('2025 · 12 · 13');
    expect(together?.iso).toBe(herProfile.since);
  });

  it('数组本身就是显示顺序：iso 降序，待填的（null）排在最后', () => {
    const isos = timeline.map((event) => event.iso);
    const filled = isos.filter((iso): iso is string => iso !== null);

    expect(filled).toEqual([...filled].sort((left, right) => right.localeCompare(left)));
    expect(isos.slice(filled.length).every((iso) => iso === null)).toBe(true);
  });

  it('title 不许是 undefined 或空字符串', () => {
    for (const event of timeline) {
      expect(typeof event.title).toBe('string');
      expect(event.title.trim()).not.toBe('');
    }
  });

  it('没有 undefined 字段混进来，必备字段都在', () => {
    expect(undefinedPaths(herProfile)).toEqual([]);

    for (const event of timeline) {
      expect(Object.keys(event)).toEqual(expect.arrayContaining(['id', 'date', 'iso', 'title']));
    }
  });

  it('显示日期与计算日期同进同退：iso 为 null 时 date 也必须为 null', () => {
    for (const event of timeline) {
      if (event.iso === null) {
        expect(event.date).toBeNull();
      } else {
        expect(event.date).not.toBeNull();
        expect(event.date?.trim()).not.toBe('');
        expect(parseIsoDate(event.iso)).not.toBeNull();
      }
    }
  });

  it('锚点 id 唯一且是 ASCII slug（照片墙点事件名回时间线要靠它）', () => {
    const ids = timeline.map((event) => event.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('note 要么不写，要么是有内容的一句话（不写空占位）', () => {
    for (const event of timeline) {
      if (event.note !== undefined) {
        expect(event.note.trim()).not.toBe('');
      }
    }
  });
});

describe('照片 ↔ 时间线绑定契约', () => {
  it('事件 photos 里的每个文件名，都能在 HerProfile.photos 里找到同名项', () => {
    for (const event of timeline) {
      for (const file of eventPhotoFiles(event)) {
        expect(
          photos.some((photo) => photo.file === file),
          `事件「${event.title}」引用了照片 ${file}，但 photos 里没有登记它`,
        ).toBe(true);
      }
    }
  });

  it('带 eventIso 的照片必须能对应到事件，而且那条事件也引用了这张照片（两个方向不许漂移）', () => {
    for (const photo of photos) {
      if (photo.eventIso === undefined || photo.eventIso === null) {
        continue;
      }

      const event = eventOfPhoto(photo);

      expect(event, `照片 ${photo.file} 写了 eventIso=${photo.eventIso}，但时间线里没有这条事件`).toBeDefined();

      if (event === undefined) {
        continue;
      }

      expect(event.iso).toBe(photo.eventIso);
      expect(eventPhotoFiles(event)).toContain(photo.file);
    }
  });

  it('反过来：每张照片都被某条事件引用，照片墙不会漏照片', () => {
    expect(unassignedPhotos().map((photo) => photo.file)).toEqual([]);
  });

  it('photos 里的文件名不重复，且只写文件名不带路径', () => {
    const files = photos.map((photo) => photo.file);

    expect(new Set(files).size).toBe(files.length);

    for (const file of files) {
      expect(file.trim()).not.toBe('');
      expect(file).not.toMatch(/[\\/]/);
    }
  });

  it('建页事件挂了至少 1 张照片：这条链路在页面上有可验证的对象', () => {
    const builtEvent = firstEventWithId('page-built');

    expect(builtEvent.iso).toBe('2026-10-12');
    expect(eventPhotoFiles(builtEvent).length).toBeGreaterThanOrEqual(1);
  });

  it('photos 里登记的每张照片都真的有文件（不留破图）', () => {
    expect(photos.length).toBeGreaterThan(0);

    for (const photo of photos) {
      const src = photoSrc(photo);

      if (/^https?:\/\//i.test(src)) {
        continue; // Supabase Storage 上的图不在本机，fs 检查不了
      }

      expect(src.startsWith('/'), `站内照片地址应以 / 开头：${src}`).toBe(true);
      expect(existsSync(path.join(PUBLIC_ROOT, src)), `缺少照片文件：public${src}`).toBe(true);
    }
  });

  it('站内路径只在 photoSrc 里拼一次', () => {
    expect(PHOTO_DIR).toBe('/media/her');
    expect(photoSrc({ file: '2026-10-12-01.jpg' })).toBe('/media/her/2026-10-12-01.jpg');
  });

  it('photoSrc：有 src 用 src（后台上传的地址），没有才退回 PHOTO_DIR + file', () => {
    expect(photoSrc({ file: '2026-10-12-01.jpg', src: '/media/9cbc46a4-upload.jpg' })).toBe(
      '/media/9cbc46a4-upload.jpg',
    );
    expect(photoSrc({ file: '2026-10-12-01.jpg', src: 'https://cdn.example.com/public-media/x.jpg' })).toBe(
      'https://cdn.example.com/public-media/x.jpg',
    );
    // 空字符串 / 只有空格不算「填了」，退回文件名拼接
    expect(photoSrc({ file: '2026-10-12-01.jpg', src: '   ' })).toBe('/media/her/2026-10-12-01.jpg');
  });

  it('时间线上那条事件拿得到照片记录（缩略图 / 照片墙共用同一份）', () => {
    const builtEvent = firstEventWithId('page-built');
    const eventPhotos = photosForEvent(builtEvent);

    expect(eventPhotos.length).toBeGreaterThanOrEqual(1);
    expect(photos).toContainEqual(first(eventPhotos));
  });

  it('照片墙分组：一个事件一组、顺序与时间线一致（没照片的组为空，页面画虚线空位）', () => {
    const groups = photoGroups();

    expect(groups.map((group) => group.event.id)).toEqual(timeline.map((event) => event.id));
    expect(
      groups.every((group) => group.photos.every((photo) => eventPhotoFiles(group.event).includes(photo.file))),
    ).toBe(true);
  });

  it('首页「最近的照片」：每个事件取第一张，最多 3 张', () => {
    const recent = recentPhotoEntries(3);
    const latest = first(recent);

    expect(recent.length).toBeLessThanOrEqual(3);
    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(latest.event.id).toBe('page-built');
    expect(first(eventPhotoFiles(latest.event))).toBe(latest.photo.file);
    expect(recentPhotoEntries(0)).toEqual([]);
  });
});

describe('绑定逻辑本身（用上面那份 fixture 验证，不依赖真实内容）', () => {
  it('事件引用的文件名按顺序去重', () => {
    expect(eventPhotoFiles(first(fixture.timeline))).toEqual(['b-2.jpg', 'b-1.jpg']);
  });

  it('photosForEvent 按引用顺序给出照片记录', () => {
    expect(photosForEvent(first(fixture.timeline), fixture).map((photo) => photo.file)).toEqual([
      'b-2.jpg',
      'b-1.jpg',
    ]);
  });

  it('分组顺序 = 时间线顺序，没有照片的事件也占一组', () => {
    const groups = photoGroups(fixture);

    expect(groups.map((group) => group.event.id)).toEqual(['b', 'a', 'c']);
    expect(groups.map((group) => group.photos.length)).toEqual([2, 1, 0]);
  });

  it('最近的照片：每个事件取第一张，取满 count 为止', () => {
    expect(recentPhotoEntries(3, fixture).map((entry) => entry.photo.file)).toEqual(['b-2.jpg', 'a-1.jpg']);
    expect(recentPhotoEntries(1, fixture).map((entry) => entry.photo.file)).toEqual(['b-2.jpg']);
    expect(recentPhotoEntries(0, fixture)).toEqual([]);
  });

  it('eventOfPhoto：先按 eventIso 找，再按文件名找', () => {
    expect(eventOfPhoto({ file: 'b-1.jpg' }, fixture)?.id).toBe('b');
    expect(eventOfPhoto({ file: 'a-1.jpg' }, fixture)?.id).toBe('a');
    expect(eventOfPhoto({ file: 'orphan.jpg' }, fixture)).toBeUndefined();
    // eventIso 说了算：即使文件名挂在别的事件下，也按 eventIso 归属
    expect(eventOfPhoto({ file: 'a-1.jpg', eventIso: '2026-02-02' }, fixture)?.id).toBe('b');
  });

  it('unassignedPhotos 能抓出没人引用的照片', () => {
    expect(unassignedPhotos(fixture).map((photo) => photo.file)).toEqual(['orphan.jpg']);
  });

  it('isLetterEmpty 与信正文是否为空一致', () => {
    expect(isLetterEmpty()).toBe(true);
    expect(isLetterEmpty(fixture)).toBe(false);
  });
});

describe('herProfile · 信', () => {
  it('开头称呼非空', () => {
    expect(letter.salutation.trim()).not.toBe('');
  });

  it('正文段落要么为空状态，要么每段都有内容（不写空占位段）', () => {
    for (const paragraph of letter.paragraphs) {
      expect(paragraph.trim()).not.toBe('');
    }
  });

  it('正文当前留空（页面显示「还没写」；用户写了之后更新本用例）', () => {
    expect(isLetterEmpty()).toBe(true);
    expect(letter.paragraphs).toEqual([]);
  });

  it('引文与落款可选：填了就必须有内容', () => {
    if (letter.quote !== undefined) {
      expect(letter.quote.trim()).not.toBe('');
    }

    if (letter.signature !== undefined) {
      expect(letter.signature.trim()).not.toBe('');
    }
  });
});

/**
 * 类型层契约：内容对象必须是只读的（`as const` 收窄）。
 * 下面两行靠 @ts-expect-error 生效 —— 哪天字段变成可写，`npm run typecheck` 会报「未使用的 @ts-expect-error」。
 * 这个函数不会被调用，写完就丢。
 */
function assertContentIsReadonly(): void {
  // @ts-expect-error HerProfile 的字段全部 readonly
  herProfile.displayName = '别的名字';
  // @ts-expect-error timeline 是只读数组，不能 push
  herProfile.timeline.push(herProfile.timeline[0]);
}

describe('类型契约（编译期检查）', () => {
  it('只读断言写在 assertContentIsReadonly 里，由 typecheck 把关', () => {
    expect(typeof assertContentIsReadonly).toBe('function');
  });
});
