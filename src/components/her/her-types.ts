/**
 * 「她」页面的视图模型：只放要渲染的字符串，不放 `HerProfile` 本体。
 *
 * 这样划线的用意：客户端组件（`her-photo-viewer.tsx`）拿到的是已经算好的纯数据，
 * `@/content/her` 的内容不会跟着进客户端 bundle。
 */

export type HerGalleryPhoto = {
  /** 锚点 id，规则见 `her-photo-anchor.ts` */
  readonly id: string;
  /** 站内图片路径，由 `photoSrc()` 拼好 */
  readonly src: string;
  /** 图片替代文本：图注优先，没有图注就用日期与事件名 */
  readonly alt: string;
  /** 「10 · 12」；事件没有 `iso` 时为 null */
  readonly day: string | null;
  /** 图注原文（`HerPhoto.caption`），可为空 */
  readonly note: string | null;
  readonly eventTitle: string | null;
  /** 「2026 年 10 月 12 日」；事件没有 `iso` 时为 null */
  readonly eventDate: string | null;
};

export type HerGalleryGroup = {
  readonly key: string;
  /** 组标题里的事件名，直接来自事件的 `title` */
  readonly heading: string;
  /** 组标题里的日期，事件没填日期时是 `DATE_PLACEHOLDER` */
  readonly headingDate: string;
  /**
   * 点标题回时间线：`/her#<事件 id>`。
   * 为 null 表示这一组不是时间线上的事件（例如末尾「还没归到事件里」那组），标题不链接。
   */
  readonly headingHref: string | null;
  /** 这个事件挂的照片；没有照片时是空数组，页面画虚线空位 */
  readonly photos: readonly HerGalleryPhoto[];
};

export type HerTimelineItemPhoto = {
  readonly href: string;
  readonly src: string;
  readonly alt: string;
};

export type HerTimelineItem = {
  /** 事件 id，直接当锚点用（`/her#<id>`） */
  readonly id: string;
  readonly title: string;
  readonly note: string | null;
  /** 显示用日期；事件没填时为 `DATE_PLACEHOLDER` */
  readonly dateLabel: string;
  /** `<time dateTime>` 用；没填时为 null */
  readonly iso: string | null;
  /** 已填日期 → 锈红圆点；待填 → 灰色圆点 */
  readonly dated: boolean;
  /** 事件 `photos[0]`；没有照片时为 null，页面画虚线空位 */
  readonly photo: HerTimelineItemPhoto | null;
};

export type HerStatCard = {
  readonly id: string;
  /** 大数字，或状态词（「今天」「待填」） */
  readonly value: string;
  /** 单位，状态词没有单位时为 null */
  readonly unit: string | null;
  readonly label: string;
  readonly note: string;
  /** 未填状态：数字与竖条降低对比度，不假装有内容 */
  readonly muted: boolean;
};
