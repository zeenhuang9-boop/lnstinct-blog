/**
 * 「她」页面的全部内容 —— 三个页面（/her、/her/photos、/her/letter）都只读这一个文件。
 *
 * 这个文件是**默认内容**：没在网站后台（`/admin/her`）保存过时，页面读的就是这里；
 * 在后台保存过一次之后，页面读 `data/her.json`，这里只在那个文件缺失或损坏时作为回退。
 *
 * ── 你（小泽）要填的地方，按需要改就行 ─────────────────────────────
 * 1. 称呼：`displayName` 现在是「小宇」（昵称，不是真名）。换称呼时 `letter.salutation` 一起改，
 *    别只改一处；真名不要写进这个文件，它会进版本库。
 * 2. 生日：`birthday`（现在是 10 月 11 日，来自你说的「10月11号」），`month` 从 1 开始。
 * 3. 纪念日：`since` = `'2025-12-13'`（你说的 12 月 13 日），也就是大事记里「在一起那天」那条。
 *    两处是同一天，改就一起改（主页第二张卡按 `since` 显示「已走过 N 天」）；
 *    留 `null` 就显示「待填」——不填就是不填，不要写假日期。
 * 4. 大事记：`timeline`。`date` 是给人看的写法，`iso` 是给机器算的，
 *    还没想起来的日子两个都留 `null`（页面显示「待填」）。
 *    数组顺序 = 页面显示顺序，写的时候请保持「`iso` 降序、待填的排最后」——页面直接按数组渲染，不再自己排序。
 * 5. 照片：
 *    a) 图片文件放进 `public/media/her/`：现在里面那张 `2026-10-12-01.jpg` 是一张占位图，
 *       用同一个文件名覆盖成你的照片即可，这个文件一个字都不用改；
 *    b) 换成别的文件名，就在 `photos` 里登记一条 `{ file: '文件名.jpg', eventIso: '事件日期' }`，`file` 只写文件名；
 *       在后台里上传的照片会把上传地址写进同一条的 `src`（如 `/media/<uuid>.jpg`），有 `src` 就优先用它。
 *    c) 再让哪个事件挂上它：那条事件的 `photos: ['文件名.jpg']`。
 *       时间线用 `photos[0]` 当缩略图，照片墙按事件分组 —— 两处都靠这一份文件名，不另写文案。
 *       没有照片的事件请保留 `photos: []`（形状统一，页面和测试都不用再判 undefined）。
 * 6. 信：`letter.paragraphs` 现在是空数组（页面显示「还没写」的空状态）。
 *    写正文时按段落放进数组，一句话一个元素；想加一句引用就填 `quote`，落款填 `signature`。
 *
 * ── 不变量（`tests/her-content.test.ts` 会盯着，破了就报错）──────────
 * - 事件 `photos` 里的每个文件名，都必须在 `profile.photos` 里能找到同名的 `file`；
 * - 反过来，`photos` 里的每一张都必须被某条事件引用，否则照片墙会漏掉它；
 * - 带 `eventIso` 的照片，那个日期必须能在 `timeline` 里找到，并且该事件也引用了这张照片；
 * - 标题不许是空字符串；文件名里不许出现 `/`（路径统一由 `PHOTO_DIR` 拼）。
 */

/** 照片目录：照片只存文件名，站内路径只在这里拼一次。 */
export const PHOTO_DIR = '/media/her';

/** 日期还没填时，页面上显示的字；三个页面共用这一个常量，不要各写一份。 */
export const DATE_PLACEHOLDER = '待填';

export type HerEvent = {
  /** 锚点 id（ASCII）：照片墙点事件名回时间线时用 `/her#<id>`，也当列表 key。 */
  readonly id: string;
  /** 显示用日期，如 `'2026 · 10 · 12'`；没有确切日期就写 null，页面显示「待填」。 */
  readonly date: string | null;
  /** 排序/计算用日期，`YYYY-MM-DD`；null 表示还没记起来，不参与任何计算。 */
  readonly iso: string | null;
  readonly title: string;
  /** 想记的一句话；不填就不显示，不要为了填满而编。 */
  readonly note?: string;
  /** 这条事件挂的照片文件名（与 `photos[].file` 同名）；时间线显示第一张。 */
  readonly photos?: readonly string[];
};

export type HerPhoto = {
  /** 只存文件名，不含目录；它是这张照片的标识：事件引用、锚点、去重都用它。 */
  readonly file: string;
  /**
   * 照片地址：后台里上传的照片会写上传接口返回的 `/media/<uuid>.jpg`（Supabase 是绝对地址）。
   * **填了就用它**，没填才退回 `PHOTO_DIR + file` —— 手放进 `public/media/her/` 的照片不用填。
   */
  readonly src?: string;
  /** 补充图注；不填则页面只用所属事件的日期与标题（文案只写一遍）。 */
  readonly caption?: string;
  /** 这张照片属于哪条事件：填事件的 `iso`；还没填日期的事件留 null/不填。 */
  readonly eventIso?: string | null;
};

export type HerProfile = {
  readonly slug: 'her';
  /** 昵称/代号占位：真名一个字都不写进来。 */
  readonly displayName: string;
  readonly tagline: string;
  /** 生日（月-日），`month` 从 1 开始；倒计时只认它。 */
  readonly birthday: { readonly month: number; readonly day: number };
  /** 在一起 / 纪念日；null = 页面显示「待填」，不显示假数字。 */
  readonly since: string | null;
  /** 建页日：「站在这页上的时间」从这天算，也是时间线里那条真实日期的出处。 */
  readonly pageBuiltOn: string;
  /** Hero 上那个年份，与 `pageBuiltOn` 的年份一致。 */
  readonly heroYear: string;
  /**
   * 大事记；数组顺序就是页面显示顺序：保持 `iso` 降序、`iso: null` 的待填条目排在最后。
   * 页面直接按数组渲染，不再自己排序（顺序权在数据层，只有这一处）。
   */
  readonly timeline: readonly HerEvent[];
  /** 全部照片；一张只登记一次，时间线通过文件名引用它。 */
  readonly photos: readonly HerPhoto[];
  /** 信；`paragraphs` 为空数组 = 还没写，页面显示空状态而不是空白。 */
  readonly letter: {
    readonly salutation: string;
    readonly paragraphs: readonly string[];
    /** 可选：信里想引用的一句话。 */
    readonly quote?: string;
    /** 可选：落款。 */
    readonly signature?: string;
  };
};

/** 时间线上的一条事件 + 它挂的照片（顺序与事件 `photos` 一致）。 */
export type HerPhotoEntry = {
  readonly photo: HerPhoto;
  readonly event: HerEvent;
};

/** 照片墙的一组：一个事件一组，没有照片的组 `photos` 为空数组。 */
export type HerPhotoGroup = {
  readonly event: HerEvent;
  readonly photos: readonly HerPhoto[];
};

export const herProfile = {
  slug: 'her',
  displayName: '小宇',
  tagline: '一页只写给你看的地方：日子、照片，还有一些一直没说完的话。',
  birthday: { month: 10, day: 11 },
  since: '2025-12-13',
  pageBuiltOn: '2026-10-12',
  heroYear: '2026',
  timeline: [
    {
      id: 'page-built',
      date: '2026 · 10 · 12',
      iso: '2026-10-12',
      title: '做这一页的那天',
      // note: '那天你没看镜头',   ← 有想记的一句话就填这里
      photos: ['2026-10-12-01.jpg'],
    },
    {
      id: 'together',
      date: '2025 · 12 · 13',
      iso: '2025-12-13',
      title: '在一起那天',
      // note 等你自己的话，别替他写
      // 这条也是纪念日（since）：主页第二张卡按它算「已走过 N 天」
      photos: [],
    },
    {
      id: 'first-meeting',
      date: null,
      iso: null,
      title: '第一次见面',
      // date: '2025 · 05 · 20', iso: '2025-05-20',   ← 想起来了就照这样填
      // 没有照片也写空数组：形状统一，页面与测试都不用再判 undefined
      photos: [],
    },
  ],
  photos: [
    {
      file: '2026-10-12-01.jpg',
      eventIso: '2026-10-12',
      // caption: '那天你没看镜头',   ← 可选；不填就只用事件的日期与标题
    },
  ],
  letter: {
    salutation: '小宇：',
    // 还没写：留空数组，页面显示「这封信还没写」。写的时候一句话一个元素。
    paragraphs: [],
    // quote: '……',
    // signature: '—— 小泽',
  },
} as const satisfies HerProfile;

/**
 * 照片地址：有 `src` 用 `src`（后台上传时写的），没有才退回 `PHOTO_DIR + file`。
 * 全站只在这里拼路径；页面里不要自己拼 `PHOTO_DIR`，否则会绕过 `src` 优先级。
 */
export function photoSrc(photo: HerPhoto): string {
  const src = photo.src?.trim();

  return src !== undefined && src.length > 0 ? src : `${PHOTO_DIR}/${photo.file}`;
}

/** 这条事件引用的照片文件名：按 `photos` 顺序去重，空名与重复项丢掉。 */
export function eventPhotoFiles(event: HerEvent): readonly string[] {
  const files: string[] = [];

  for (const file of event.photos ?? []) {
    if (typeof file === 'string' && file.length > 0 && !files.includes(file)) {
      files.push(file);
    }
  }

  return files;
}

/**
 * 这条事件挂的照片记录（顺序同 `event.photos`）。
 * 文件名在 `profile.photos` 里查不到时这里会跳过它 —— 那是数据错误，
 * 由 `unassignedPhotos` 与 `tests/her-content.test.ts` 报出来，不在这里静默兜底。
 */
export function photosForEvent(event: HerEvent, profile: HerProfile = herProfile): readonly HerPhoto[] {
  return eventPhotoFiles(event)
    .map((file) => profile.photos.find((photo) => photo.file === file))
    .filter((photo): photo is HerPhoto => photo !== undefined);
}

/**
 * 反查这张照片属于哪条事件（照片墙的组标题、图注都从这里取，页面不另写文案）：
 * 先按 `eventIso` 找，找不到再按文件名找；
 * 两者不一致属于数据漂移，测试会报错。
 */
export function eventOfPhoto(photo: HerPhoto, profile: HerProfile = herProfile): HerEvent | undefined {
  const iso = typeof photo.eventIso === 'string' ? photo.eventIso : null;

  if (iso !== null) {
    const byIso = profile.timeline.find((event) => event.iso === iso);

    if (byIso !== undefined) {
      return byIso;
    }
  }

  return profile.timeline.find((event) => eventPhotoFiles(event).includes(photo.file));
}

/** 照片墙的分组：时间线上的每个事件都是一组（没照片的组为空数组，页面画虚线空位）。 */
export function photoGroups(profile: HerProfile = herProfile): readonly HerPhotoGroup[] {
  return profile.timeline.map((event) => ({ event, photos: photosForEvent(event, profile) }));
}

/**
 * 「最近的照片」：按时间线顺序每个事件取第一张，取满 `count` 个为止。
 * 刻意不是「最后拍了哪几张」而是「每个事件露一张」，这样首页能覆盖到不同日子。
 */
export function recentPhotoEntries(count: number, profile: HerProfile = herProfile): readonly HerPhotoEntry[] {
  const entries: HerPhotoEntry[] = [];

  for (const event of profile.timeline) {
    if (entries.length >= count) {
      break;
    }

    const [photo] = photosForEvent(event, profile);

    if (photo === undefined) {
      continue;
    }

    entries.push({ photo, event });
  }

  return entries;
}

/** 没有被任何事件引用的照片（正常应为空；不为空说明照片墙会漏掉它，测试会报错）。 */
export function unassignedPhotos(profile: HerProfile = herProfile): readonly HerPhoto[] {
  const referenced = new Set(profile.timeline.flatMap((event) => eventPhotoFiles(event)));

  return profile.photos.filter((photo) => !referenced.has(photo.file));
}

/** 信还没写：正文为空数组。页面据此显示空状态，而不是显示一片空白。 */
export function isLetterEmpty(profile: HerProfile = herProfile): boolean {
  return profile.letter.paragraphs.length === 0;
}
