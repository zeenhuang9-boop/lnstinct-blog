import { z } from 'zod';

import { daysInMonth, parseIsoDate } from '@/lib/date';

/**
 * 「她」页面内容的运行时校验：**写盘前必须过这一关**，读盘时再校验一次。
 *
 * 与 `src/domain/input-schemas.ts` 同风格：`z.object(...).strict()`，未知字段直接拒（防拼写错误静默丢字段）。
 * 日期不自己写正则，而是复用 `@/lib/date` 的 `parseIsoDate` / `daysInMonth` —— 校验口径与页面计算口径
 * 必须是同一套，否则会出现「校验通过但页面算不出来」的日期。
 *
 * 除了字段本身，这里还挡住三类**会把页面弄坏**的组合（见文件末尾）：
 * - 事件 `iso` 为 null 时 `date` 必须也为 null（显示日期不能比机器日期更确定）；
 * - 事件 `id` 与已填 `iso` 都不得重复（锚点与反查都靠它们）；
 * - 事件引用的照片文件名必须已在 `photos` 里登记（否则是破图）。
 *
 * 刻意**不**在这里要求「每张照片都必须被事件引用」：刚上传、还没选归属事件的照片必须存得下来，
 * 否则用户的上传会被整份文件校验失败吞掉（详见 `unassignedPhotos`）。
 *
 * schema 输出与 `HerProfile` 的类型对账在 `src/lib/content/her-source.ts` 里做：
 * 那里把 `herProfileSchema.parse(...)` 的结果直接标成 `HerProfile`，改一边忘另一边会编译报错。
 */

/** 站内相对路径（`/media/xxx.jpg`）或 http(s) 绝对地址（Supabase Storage 返回的就是这种）。 */
const photoSrcSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => value.startsWith('/') || /^https?:\/\/\S+$/i.test(value), {
    message: '照片地址必须是站内路径（/media/...）或 http(s) 地址',
  });

/** 真实存在的 `YYYY-MM-DD`（2026-02-30、2025-02-29 这类会被拒）。 */
const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => parseIsoDate(value) !== null, { message: '日期必须是真实存在的 YYYY-MM-DD' });

/** 文件名：纯文件名，不含任何路径分隔符（路径只由 `photoSrc()` 负责拼）。 */
const photoFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !/[\\/]/.test(value), { message: '只写文件名，不要带路径分隔符' });

const herEventSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => /^[a-z0-9-]+$/.test(value), { message: 'id 只允许小写字母、数字与短横线' }),
    date: z.string().trim().min(1).max(40).nullable(),
    iso: isoDateSchema.nullable(),
    title: z.string().trim().min(1).max(120),
    note: z.string().trim().min(1).max(500).optional(),
    photos: z.array(photoFileSchema).max(200).optional(),
  })
  .strict();

const herPhotoSchema = z
  .object({
    file: photoFileSchema,
    src: photoSrcSchema.optional(),
    caption: z.string().trim().min(1).max(500).optional(),
    eventIso: isoDateSchema.nullable().optional(),
  })
  .strict();

const herLetterSchema = z
  .object({
    salutation: z.string().trim().min(1).max(32),
    paragraphs: z.array(z.string().trim().min(1).max(4000)).max(200),
    quote: z.string().trim().min(1).max(500).optional(),
    signature: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const herProfileObjectSchema = z
  .object({
    slug: z.literal('her'),
    displayName: z.string().trim().min(1).max(32),
    tagline: z.string().trim().min(1).max(200),
    birthday: z
      .object({
        month: z.number().int().min(1).max(12),
        // 用闰年（2000）判上限：2-29 合法，4-31 这种「哪一年都不存在」的日期被拒。
        day: z.number().int().min(1).max(31),
      })
      .strict()
      .refine((value) => value.day <= daysInMonth(2000, value.month), {
        message: '这个月没有这一天',
        path: ['day'],
      }),
    since: isoDateSchema.nullable(),
    pageBuiltOn: isoDateSchema,
    heroYear: z
      .string()
      .trim()
      .refine((value) => /^\d{4}$/.test(value), { message: 'heroYear 是四位年份，如 2026' }),
    timeline: z.array(herEventSchema),
    photos: z.array(herPhotoSchema),
    letter: herLetterSchema,
  })
  .strict();

export const herProfileSchema = herProfileObjectSchema
  .refine((profile) => profile.timeline.every((event) => (event.iso === null) === (event.date === null)), {
    message: '事件的 date 与 iso 必须同时有或同时为 null',
    path: ['timeline'],
  })
  .refine((profile) => new Set(profile.timeline.map((event) => event.id)).size === profile.timeline.length, {
    message: '事件的 id 必须唯一（照片墙的锚点靠它）',
    path: ['timeline'],
  })
  .refine(
    (profile) => {
      const filled = profile.timeline.map((event) => event.iso).filter((iso): iso is string => iso !== null);

      return new Set(filled).size === filled.length;
    },
    { message: '已填日期的 iso 必须唯一（否则照片的 eventIso 会指错事件）', path: ['timeline'] },
  )
  .refine((profile) => new Set(profile.photos.map((photo) => photo.file)).size === profile.photos.length, {
    message: 'photos 里的文件名不能重复',
    path: ['photos'],
  })
  .refine(
    (profile) => {
      const registered = new Set(profile.photos.map((photo) => photo.file));

      return profile.timeline.every((event) => (event.photos ?? []).every((file) => registered.has(file)));
    },
    { message: '事件引用的照片文件名必须先在 photos 里登记（否则是破图）', path: ['timeline'] },
  )
  .refine(
    (profile) => {
      const isos = new Set(
        profile.timeline.map((event) => event.iso).filter((iso): iso is string => iso !== null),
      );

      return profile.photos.every((photo) => photo.eventIso === undefined || photo.eventIso === null || isos.has(photo.eventIso));
    },
    { message: '照片的 eventIso 必须能在 timeline 里找到对应事件', path: ['photos'] },
  );
