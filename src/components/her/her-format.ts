import { parseIsoDate } from '@/lib/date';

/**
 * 「她」页面的日期显示格式。
 *
 * 只做格式化，不做日期数学：换算与倒计时全部在 `src/lib/date/`，
 * 这里拿到的 `iso` 也是那边 `parseIsoDate` 解析过的，不会出现「差一天」。
 * 没有 `new Date()`，因此不受运行时区影响。
 */

/** `'2026-10-12'` → `'10 · 12'`（照片墙图注的日期部分）。日期不合法返回 null。 */
export function formatPhotoDay(iso: string | null): string | null {
  const date = parseIsoDate(iso);

  if (date === null) {
    return null;
  }

  return `${pad(date.month)} · ${pad(date.day)}`;
}

/** `'2026-10-12'` → `'2026 年 10 月 12 日'`。日期不合法返回 null。 */
export function formatLongDate(iso: string | null): string | null {
  const date = parseIsoDate(iso);

  return date === null ? null : formatLongDateParts(date);
}

/** `{ year, month, day }` → `'2026 年 10 月 12 日'`。 */
export function formatLongDateParts(date: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}): string {
  return `${date.year} 年 ${date.month} 月 ${date.day} 日`;
}

/** `{ year, month, day }` → `'2026-10-12'`，给 `<time dateTime>` 用。 */
export function toIsoDate(date: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** `{ year, month }` → `'2026 · 10'`（信末落款下的年月）。 */
export function formatYearMonth(date: { readonly year: number; readonly month: number }): string {
  return `${date.year} · ${pad(date.month)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
