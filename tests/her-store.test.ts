import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { herProfile } from '@/content/her';
import { herProfileSchema } from '@/domain/her-schemas';
import { HER_DATA_NAME, getHerProfile, readHerProfile, saveHerProfile } from '@/lib/content/her-source';
import { readObject, writeObject } from '@/lib/store/files';

/**
 * 「她」内容的存储与回退：`data/her.json`（单对象）→ zod → 用；坏了/缺失就回退默认内容，且不覆盖现场。
 * 所有用例都在临时目录里跑：`LNSTINCT_DATA_DIR` 是数据目录的唯一开关（与 tests/file-repository.test.ts 同法）。
 *
 * 一条纪律：**除了「默认内容本身合法」那一条，其余用例都用自造数据**，不依赖 `src/content/her.ts` 当前的
 * 具体日期。默认内容是给人改的（还能在后台改），测试跟着它变红就是假红。
 */
let tempDir: string;
let herFile: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'lnstinct-her-'));
  process.env.LNSTINCT_DATA_DIR = tempDir;
  herFile = path.join(tempDir, `${HER_DATA_NAME}.json`);
});

afterEach(async () => {
  delete process.env.LNSTINCT_DATA_DIR;
  await rm(tempDir, { recursive: true, force: true });
});

/** 默认内容的一份可变副本（只改字段值，不动 `as const` 的原始对象）。 */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(herProfile)) as Record<string, unknown>;

  return { ...copy, ...overrides };
}

/** 一条最小合法事件；`photos` 默认空数组，可用 extra 覆盖。 */
function makeEvent(id: string, iso: string | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    date: iso === null ? null : iso.split('-').join(' · '),
    iso,
    title: `事件 ${id}`,
    photos: [],
    ...extra,
  };
}

/** 一张最小合法照片。 */
function makePhoto(file: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { file, ...extra };
}

/** 自造一份「事件 + 照片」都自洽的内容，避免依赖默认内容的具体日期。 */
function synthetic(options: {
  timeline: Record<string, unknown>[];
  photos?: Record<string, unknown>[];
  overrides?: Record<string, unknown>;
}): Record<string, unknown> {
  return payload({ timeline: options.timeline, photos: options.photos ?? [], ...options.overrides });
}

/** 一条没有任何照片的事件，用来隔离「照片字段」类规则。 */
const EVENT_WITHOUT_PHOTOS = [makeEvent('solo', '2024-03-03')];

function issuePaths(result: {
  success: boolean;
  error?: { issues: readonly { readonly path?: readonly PropertyKey[] }[] };
}): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path?.map(String).join('.') ?? '(根)');
}

describe('herProfileSchema', () => {
  it('默认内容本身必须合法（否则回退给出的就是非法数据）', () => {
    const result = herProfileSchema.safeParse(herProfile);

    expect(result.success, JSON.stringify(issuePaths(result))).toBe(true);
  });

  it('拒绝越界的生日：month 13、4 月 31 日', () => {
    const monthOverflow = herProfileSchema.safeParse(payload({ birthday: { month: 13, day: 11 } }));

    expect(monthOverflow.success).toBe(false);
    expect(issuePaths(monthOverflow)).toContain('birthday.month');

    // 闰年判上限：2-29 合法，4-31 哪一年都不存在
    expect(herProfileSchema.safeParse(payload({ birthday: { month: 2, day: 29 } })).success).toBe(true);
    expect(herProfileSchema.safeParse(payload({ birthday: { month: 4, day: 31 } })).success).toBe(false);
  });

  it('拒绝不存在的日期：2026-02-30、2025-02-29、非 YYYY-MM-DD', () => {
    expect(herProfileSchema.safeParse(payload({ since: '2026-02-30' })).success).toBe(false);
    expect(herProfileSchema.safeParse(payload({ pageBuiltOn: '2025-02-29' })).success).toBe(false);
    expect(herProfileSchema.safeParse(payload({ pageBuiltOn: '2026-2-1' })).success).toBe(false);
  });

  it('拒绝未知字段（.strict()，防止拼错字段名被静默丢掉）', () => {
    expect(herProfileSchema.safeParse(payload({ dispalyName: '打错的字段名' })).success).toBe(false);
  });

  it('拒绝 slug 被改掉', () => {
    expect(herProfileSchema.safeParse(payload({ slug: 'she' })).success).toBe(false);
  });

  it('拒绝「显示日期有、机器日期没有」的事件，也拒绝反过来的组合', () => {
    const onlyDate = synthetic({ timeline: [makeEvent('a', null, { date: '2024 · 03 · 03' })] });
    expect(herProfileSchema.safeParse(onlyDate).success).toBe(false);

    const onlyIso = synthetic({ timeline: [makeEvent('a', '2024-03-03', { date: null })] });
    expect(herProfileSchema.safeParse(onlyIso).success).toBe(false);
  });

  it('拒绝重复的事件 id 与重复的已填日期', () => {
    const sameId = synthetic({ timeline: [makeEvent('dup', '2024-03-03'), makeEvent('dup', '2023-02-02')] });
    expect(herProfileSchema.safeParse(sameId).success).toBe(false);

    const sameIso = synthetic({ timeline: [makeEvent('a', '2024-03-03'), makeEvent('b', '2024-03-03')] });
    expect(herProfileSchema.safeParse(sameIso).success).toBe(false);

    // 两条都待填（iso 全是 null）不算重复
    const bothPending = synthetic({ timeline: [makeEvent('a', null), makeEvent('b', null)] });
    expect(herProfileSchema.safeParse(bothPending).success).toBe(true);
  });

  it('拒绝事件引用未登记的照片（破图防线）', () => {
    const withGhost = synthetic({ timeline: [makeEvent('a', '2024-03-03', { photos: ['ghost.jpg'] })] });

    expect(herProfileSchema.safeParse(withGhost).success).toBe(false);
  });

  it('拒绝 eventIso 指不到任何事件的照片', () => {
    const unmatched = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('photo-01.jpg', { eventIso: '1999-01-01' })],
    });

    expect(herProfileSchema.safeParse(unmatched).success).toBe(false);

    const matched = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('photo-01.jpg', { eventIso: '2024-03-03' })],
    });

    expect(herProfileSchema.safeParse(matched).success).toBe(true);
  });

  it('拒绝带路径分隔符的文件名，但允许 src 是站内路径或 http(s) 地址', () => {
    const withSubdir = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('sub/photo-01.jpg')],
    });
    expect(herProfileSchema.safeParse(withSubdir).success).toBe(false);

    const local = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('photo-01.jpg', { src: '/media/9cbc46a4-upload.jpg' })],
    });
    expect(herProfileSchema.safeParse(local).success).toBe(true);

    const remote = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('photo-01.jpg', { src: 'https://cdn.example.com/public-media/x.jpg' })],
    });
    expect(herProfileSchema.safeParse(remote).success).toBe(true);

    const bad = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('photo-01.jpg', { src: 'javascript:alert(1)' })],
    });
    expect(herProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('允许「刚上传、还没选归属事件」的照片（否则用户的上传会被整份校验吞掉）', () => {
    const freshUpload = synthetic({
      timeline: EVENT_WITHOUT_PHOTOS,
      photos: [makePhoto('fresh-upload.jpg', { src: '/media/fresh-upload.jpg' })],
    });

    expect(herProfileSchema.safeParse(freshUpload).success).toBe(true);
  });
});

describe('getHerProfile / readHerProfile 的回退', () => {
  it('文件不存在：回退默认内容，说明原因，且不凭空造文件', async () => {
    const result = await readHerProfile();

    expect(result.source).toBe('default');
    expect(result.problem?.kind).toBe('missing');
    expect(result.problem?.file).toBe(herFile);
    expect(result.profile.displayName).toBe(herProfile.displayName);
    expect(await readdir(tempDir)).toEqual([]);
  });

  it('getHerProfile 永不返回 null：没有文件也给出可渲染的内容', async () => {
    const profile = await getHerProfile();

    expect(profile.displayName).toBe(herProfile.displayName);
    expect(profile.timeline).toHaveLength(herProfile.timeline.length);
  });

  it('JSON 损坏：回退默认内容，并保留现场（原文件一个字不改）', async () => {
    const broken = '{ 这不是 JSON';
    await writeFile(herFile, broken, 'utf8');

    const result = await readHerProfile();

    expect(result.source).toBe('default');
    expect(result.problem?.kind).toBe('unreadable');
    expect(result.profile.displayName).toBe(herProfile.displayName);
    expect(await readFile(herFile, 'utf8')).toBe(broken);
  });

  it('顶层是数组：同样按不可用处理，并保留现场', async () => {
    await writeFile(herFile, '[]', 'utf8');

    const result = await readHerProfile();

    expect(result.problem?.kind).toBe('unreadable');
    expect(await readFile(herFile, 'utf8')).toBe('[]');
  });

  it('合法 JSON 但校验不过：回退默认内容，报出出错字段，并保留现场', async () => {
    const invalid = payload({ birthday: { month: 13, day: 11 } });
    await writeFile(herFile, `${JSON.stringify(invalid, null, 2)}\n`, 'utf8');

    const result = await readHerProfile();

    expect(result.source).toBe('default');
    expect(result.problem?.kind).toBe('invalid');
    expect(result.problem?.message).toContain('birthday.month');
    expect(result.profile.birthday).toEqual({ month: 10, day: 11 });
    expect(JSON.parse(await readFile(herFile, 'utf8'))).toEqual(invalid);
  });

  it('坏文件之后显式保存一次即可恢复（覆盖必须由保存动作发起）', async () => {
    await writeFile(herFile, '{ 坏掉的', 'utf8');
    expect((await readHerProfile()).source).toBe('default');

    await saveHerProfile(payload());

    const result = await readHerProfile();
    expect(result.source).toBe('file');
    expect(result.problem).toBeNull();
  });
});

describe('saveHerProfile 的读→写→读回环', () => {
  it('写盘再读回：内容一致，来源变成 file', async () => {
    const saved = await saveHerProfile(payload({ displayName: '改过的称呼', since: null }));

    expect(saved.displayName).toBe('改过的称呼');

    const result = await readHerProfile();
    expect(result.source).toBe('file');
    expect(result.problem).toBeNull();
    expect(result.profile.displayName).toBe('改过的称呼');
    expect(result.profile.since).toBeNull();
    expect(result.profile.timeline).toEqual(saved.timeline);
    expect(result.profile.photos).toEqual(saved.photos);

    expect(await getHerProfile()).toEqual(saved);
  });

  it('磁盘上是单对象 JSON（不是数组）', async () => {
    await saveHerProfile(payload());

    const onDisk = JSON.parse(await readFile(herFile, 'utf8')) as unknown;

    expect(Array.isArray(onDisk)).toBe(false);
    expect((onDisk as { slug?: string }).slug).toBe('her');
  });

  it('原子写不留 .tmp 残留', async () => {
    await saveHerProfile(payload());

    expect(await readdir(tempDir)).toEqual([`${HER_DATA_NAME}.json`]);
  });

  it('校验不过时不写盘（连空文件都不留）', async () => {
    await expect(saveHerProfile(payload({ birthday: { month: 13, day: 11 } }))).rejects.toThrow();

    expect(existsSync(herFile)).toBe(false);
    expect(await readdir(tempDir)).toEqual([]);
  });

  it('已存在的文件在保存失败时保持原样', async () => {
    await saveHerProfile(payload({ displayName: '第一版' }));
    const before = await readFile(herFile, 'utf8');

    await expect(saveHerProfile(payload({ displayName: '' }))).rejects.toThrow();

    expect(await readFile(herFile, 'utf8')).toBe(before);
    expect((await getHerProfile()).displayName).toBe('第一版');
  });

  it('写盘时把时间线归一化为「iso 降序、null 排最后」（顺序的权威在数据层）', async () => {
    const messy = synthetic({
      timeline: [makeEvent('old', '2023-02-02'), makeEvent('pending', null), makeEvent('new', '2024-03-03')],
    });

    const saved = await saveHerProfile(messy);

    expect(saved.timeline.map((event) => event.id)).toEqual(['new', 'old', 'pending']);
    expect(saved.timeline.map((event) => event.iso)).toEqual(['2024-03-03', '2023-02-02', null]);

    const onDisk = JSON.parse(await readFile(herFile, 'utf8')) as {
      timeline: { id: string; iso: string | null }[];
    };
    expect(onDisk.timeline.map((event) => event.id)).toEqual(['new', 'old', 'pending']);
  });

  it('手改乱序的文件读回来也被纠正（读侧走同一个归一化）', async () => {
    const handEdited = synthetic({
      timeline: [makeEvent('pending', null), makeEvent('new', '2024-03-03'), makeEvent('old', '2023-02-02')],
    });
    await writeFile(herFile, `${JSON.stringify(handEdited, null, 2)}\n`, 'utf8');

    const result = await readHerProfile();

    expect(result.source).toBe('file');
    expect(result.profile.timeline.map((event) => event.id)).toEqual(['new', 'old', 'pending']);
  });
});

describe('readObject / writeObject', () => {
  it('单对象读写回环', async () => {
    await writeObject('demo', { a: 1, b: '两' });

    expect(await readObject<{ a: number; b: string }>('demo')).toEqual({ a: 1, b: '两' });
    expect(await readdir(tempDir)).toEqual(['demo.json']);
  });

  it('文件不存在时返回 null', async () => {
    expect(await readObject('nope')).toBeNull();
  });

  it('数组与损坏的 JSON 都按 null 处理（调用方负责回退）', async () => {
    await writeFile(path.join(tempDir, 'arr.json'), '[]', 'utf8');
    await writeFile(path.join(tempDir, 'broken.json'), '{ 坏', 'utf8');

    expect(await readObject('arr')).toBeNull();
    expect(await readObject('broken')).toBeNull();
  });

  it('writeObject 拒绝数组：不会写出「读回来是 null」的数据', async () => {
    await expect(writeObject('arr2', [1, 2])).rejects.toThrow('writeObject 只接受 JSON 对象');

    expect(await readdir(tempDir)).toEqual([]);
  });
});
