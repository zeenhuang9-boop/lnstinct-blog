import {
  DATE_PLACEHOLDER,
  photoGroups,
  photoSrc,
  photosForEvent,
  recentPhotoEntries,
  unassignedPhotos,
  type HerEvent,
  type HerPhoto,
  type HerProfile,
} from '@/content/her';
import { daysTogether, describeBirthday, occurrenceOf, type CalendarDate } from '@/lib/date';

import { formatLongDate, formatPhotoDay } from './her-format';
import { photoAnchorId } from './her-photo-anchor';
import type { HerGalleryGroup, HerGalleryPhoto, HerStatCard, HerTimelineItem } from './her-types';

/**
 * 页面视图模型的派生层：把一份 `HerProfile` 换成「她」三页直接渲染的字符串。
 *
 * 四条边界：
 * - **内容从参数进来**：这份 `HerProfile` 由三个 page 在服务器侧用 `getHerProfile()` 取
 *   （`data/her.json` → 后台上传/编辑写的那份，读不到才回退 `src/content/her.ts`）。
 *   这里**不 import 默认内容**，否则后台存了也是白存；
 * - 分组、路径、反查全部走内容文件给的派生函数（`photoGroups` / `photosForEvent` /
 *   `photoSrc` / `recentPhotoEntries`），这里不重算一遍；
 * - **顺序的权威在数据层**：`timeline` 的数组顺序就是页面从上到下的顺序，
 *   这里一律不排序，否则会出现两套顺序；
 * - 这个文件只在服务器组件里 import。客户端查看器（`her-photo-viewer.tsx`）拿到的是
 *   算好的 props，`herProfile` 不会跟着进客户端 bundle。
 */

/** 时间线的每一条（数组原顺序），照片取事件的 `photos[0]`。 */
export function buildTimelineItems(profile: HerProfile): HerTimelineItem[] {
  return profile.timeline.map((event) => {
    const [photo] = photosForEvent(event, profile);
    const day = formatPhotoDay(event.iso);

    return {
      id: event.id,
      title: event.title,
      note: event.note ?? null,
      dateLabel: event.date ?? DATE_PLACEHOLDER,
      iso: event.iso,
      dated: event.date !== null || event.iso !== null,
      photo:
        photo === undefined
          ? null
          : {
              href: `/her/photos#${photoAnchorId(photo.file)}`,
              src: photoSrc(photo),
              alt: joinParts([day, photo.caption ?? event.title]),
            },
    };
  });
}

/**
 * 照片墙的分组：每个事件一组（含没有照片的空组，顺序同 `timeline`），
 * 末尾按需追加一组「还没归到事件里」的未归属照片。
 *
 * 为什么要这一组：`herProfileSchema` 刻意允许「照片没有被任何事件引用」存下来
 * （刚上传、还没选归属的照片不能因为整份校验失败被吞掉），而照片墙是按事件分组的——
 * 不补这一组的话，用户在后台传完照片、打开照片墙会一张都看不到，以为照片丢了。
 * 真实的操作顺序就是「先传照片、后补事件」，所以这一组不是兜底，是主路径之一。
 */
export function buildGalleryGroups(profile: HerProfile): HerGalleryGroup[] {
  const groups: HerGalleryGroup[] = photoGroups(profile).map((group) => ({
    key: group.event.id,
    heading: group.event.title,
    headingDate: group.event.date ?? DATE_PLACEHOLDER,
    headingHref: `/her#${group.event.id}`,
    photos: group.photos.map((photo) => toGalleryPhoto(photo, group.event)),
  }));

  const unassigned = unassignedPhotos(profile);

  if (unassigned.length > 0) {
    groups.push({
      key: 'her-unassigned',
      heading: '还没归到事件里',
      headingDate: '在「照片」里给它们选一个事件',
      // 这一组不是时间线上的事件，所以没有回时间线的链接。
      headingHref: null,
      photos: unassigned.map((photo) => toGalleryPhoto(photo, null)),
    });
  }

  return groups;
}

/** 「最近的照片」：按内容文件的语义「每个事件露一张」，取满 `count` 个。 */
export function buildRecentPhotos(count: number, profile: HerProfile): HerGalleryPhoto[] {
  return recentPhotoEntries(count, profile).map((entry) => toGalleryPhoto(entry.photo, entry.event));
}

/** 照片墙顶部那句「共 N 张 · M 个事件」。 */
export function buildPhotoSummary(profile: HerProfile): {
  photoCount: number;
  groupCount: number;
} {
  return {
    photoCount: profile.photos.length,
    groupCount: photoGroups(profile).length,
  };
}

/**
 * 两张数字卡 + 卡片底部那行脚注。
 *
 * - 第一张：距离下一次生日；生日当天显示「今天」，不显示 0 天；
 * - 第二张：纪念日填了就是「已走过 N 天」，没填就退回「站在这页上的时间」（建页日是真实已知的），
 *   「待填」放到脚注那一行，不拿 0 冒充一个不知道的日子。
 */
export function buildStatCards(
  today: CalendarDate,
  profile: HerProfile,
): { cards: HerStatCard[]; footnote: string | null } {
  const birthday = describeBirthday(today, profile.birthday);
  const birthdayLabel = `${profile.birthday.month} 月 ${profile.birthday.day} 日`;

  // 下一次生日**真正落在哪一天**：2-29 的生日在平年会收拢到 2-28，
  // 这里若直接用「月 + 日」拼文案，就会写出「2027 年 2 月 29 日」这种不存在的日期。
  const landing = occurrenceOf(birthday.nextOccurrenceYear, profile.birthday);
  const landingLabel = `${landing.year} 年 ${landing.month} 月 ${landing.day} 日`;

  const standing = daysTogether(today, profile.pageBuiltOn);
  const together = daysTogether(today, profile.since);

  const birthdayCard: HerStatCard = {
    id: 'birthday',
    value: birthday.isToday ? '今天' : String(birthday.daysUntil),
    unit: birthday.isToday ? null : '天',
    label: birthday.isToday ? `今天是她的生日 · ${birthdayLabel}` : `距离下一次生日 · ${birthdayLabel}`,
    note: birthday.isToday
      ? '就是今天，这张卡不用再数了。'
      : landing.day === profile.birthday.day
        ? `下一次落在 ${landingLabel}`
        : `下一次落在 ${landingLabel}（这一天平年没有 2 月 29 日，按 2 月 28 日算）`,
    muted: false,
  };

  const sinceLabel = formatLongDate(profile.since);

  if (together !== null && sinceLabel !== null) {
    // `daysTogether` 对「还没到的那天」返回负数且不夹到 0（见 src/lib/date/birthday.ts 的说明），
    // 所以这里分开说：已经走过 → 「已走过的日子」，还没到 → 「距离…还有 N 天」。
    // 否则页面上会出现「已走过的日子：-62 天」这种一眼就是坏掉的数字。
    const upcoming = together < 0;

    return {
      cards: [
        birthdayCard,
        {
          id: 'together',
          value: String(upcoming ? Math.abs(together) : together),
          unit: '天',
          label: upcoming
            ? `距离在一起纪念日 · ${sinceLabel}`
            : '已走过的日子 · 在一起纪念日',
          note: upcoming ? '这一天还没到。' : `从 ${sinceLabel}起算`,
          muted: false,
        },
      ],
      footnote: null,
    };
  }

  const builtOnLabel = formatLongDate(profile.pageBuiltOn) ?? profile.pageBuiltOn;

  return {
    cards: [
      birthdayCard,
      // 建页日在未来时 daysTogether 会给出负数（它刻意不夹到 0）。后台表单已经拦了，
      // 但这里也兜一层：万一是直接改文件写进来的，宁可显示倒计时，也不显示「-45 天」。
      standing !== null && standing < 0
        ? {
            id: 'standing',
            value: String(Math.abs(standing)),
            unit: '天',
            label: `距离建页日 · ${builtOnLabel}`,
            note: '这一天还没到。',
            muted: false,
          }
        : {
            id: 'standing',
            value: standing === null ? DATE_PLACEHOLDER : String(standing),
            unit: standing === null ? null : '天',
            label: '站在这页上的时间 · 建页纪念日',
            note: `建页日 ${builtOnLabel}`,
            muted: standing === null,
          },
    ],
    footnote: '在一起纪念日 · 待填',
  };
}

/** `event` 为 null 表示这张照片还没归到任何事件（见 `buildGalleryGroups` 的尾组）。 */
function toGalleryPhoto(photo: HerPhoto, event: HerEvent | null): HerGalleryPhoto {
  const day = event === null ? null : formatPhotoDay(event.iso);
  const note = photo.caption ?? null;
  const eventTitle = event?.title ?? null;

  return {
    id: photoAnchorId(photo.file),
    src: photoSrc(photo),
    // 没有事件也没有图注时留一个能读的兜底，别让查看器按钮的名字变成「放大查看：」。
    alt: joinParts([day, note ?? eventTitle]) || '照片',
    day,
    note,
    eventTitle,
    eventDate: event === null ? null : formatLongDate(event.iso),
  };
}

/** 用 ` · ` 拼可见文案，空段丢掉，全空时返回空字符串。 */
function joinParts(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join(' · ');
}
