/**
 * 生日倒计时：只有日期数学，没有「现在几点」。
 *
 * 约定：
 * - `month` 一律从 1 开始（10 表示十月），与 `src/content/her.ts` 里的生日写法一致；
 * - `describeBirthday` 与 `daysTogether` 是纯函数，体内不读系统时间（不出现 `new Date()`／`Date.now()`），
 *   「今天」由调用方显式传入；读系统时间的那一层单独放在 `./today.ts`（固定 Asia/Shanghai）；
 * - 生日当天 `daysUntil = 0`；生日次日即为下一次生日的天数；
 * - 2 月 29 日的生日在平年落到 2 月 28 日：不抛错、不留空。
 */

export type CalendarDate = {
  readonly year: number;
  /** 1-12 */
  readonly month: number;
  /** 1-31 */
  readonly day: number;
};

export type MonthDay = {
  /** 1-12 */
  readonly month: number;
  /** 1-31；超出当月天数时收拢到当月最后一天（2-29 在平年 → 2-28） */
  readonly day: number;
};

export type BirthdaySummary = {
  /** 今天就是生日（含 2-29 的生日落在平年 2-28 的那一天） */
  readonly isToday: boolean;
  /** 0 表示就是今天；否则是距离下一次生日的整天数 */
  readonly daysUntil: number;
  /**
   * `daysUntil` 数到的那次生日落在哪一年。
   * 注意这是「下一次生日」的年份，不是「下一个闰年」：2-29 的生日在平年数到的是 2-28，
   * 例如 2027-03-01 数到的是 2027（2027-02-28），真正的闰日生日要等到 2028。
   */
  readonly nextOccurrenceYear: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 某年某月有多少天。
 * `new Date(Date.UTC(year, month, 0))` 取的是第 month 月（month 从 1 起）的最后一天，
 * 闰年规则交给 Date 自己判断——这个 Date 完全由参数决定，不读系统时间。
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 把「月-日」落到具体某一年：2-29 在平年落到 2-28；越界的月/日先收拢到合法范围。 */
export function occurrenceOf(year: number, birthday: MonthDay): CalendarDate {
  const month = clamp(Math.trunc(birthday.month), 1, 12);

  return {
    year,
    month,
    day: clamp(Math.trunc(birthday.day), 1, daysInMonth(year, month)),
  };
}

/** 解析 `YYYY-MM-DD`；格式不对或日期不存在（如 `2026-02-30`）返回 null，不返回 NaN 这类脏值。 */
export function parseIsoDate(iso: string | null | undefined): CalendarDate | null {
  if (typeof iso !== 'string') {
    return null;
  }

  const matched = ISO_DATE_PATTERN.exec(iso.trim());

  if (matched === null) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

/**
 * 距离下一次生日还有几天。
 *
 * - 生日当天：`{ isToday: true, daysUntil: 0, nextOccurrenceYear: 今天所在年 }`；
 * - 生日已过（含生日次日）：顺延到下一年，`daysUntil` 因此可能是 364～366；
 * - 2-29 的生日：闰年落在 2-29，平年落在 2-28。
 */
export function describeBirthday(today: CalendarDate, birthday: MonthDay): BirthdaySummary {
  const todayUtc = toUtc(today);
  const thisYearUtc = toUtc(occurrenceOf(today.year, birthday));

  if (todayUtc === thisYearUtc) {
    return { isToday: true, daysUntil: 0, nextOccurrenceYear: today.year };
  }

  if (todayUtc < thisYearUtc) {
    return {
      isToday: false,
      daysUntil: diffInDays(todayUtc, thisYearUtc),
      nextOccurrenceYear: today.year,
    };
  }

  const nextYearUtc = toUtc(occurrenceOf(today.year + 1, birthday));

  return {
    isToday: false,
    daysUntil: diffInDays(todayUtc, nextYearUtc),
    nextOccurrenceYear: today.year + 1,
  };
}

/**
 * 「已走过 N 天」：从 `iso` 那天数到 `today` 那天（同一天 = 0）。
 *
 * - `iso` 为 null（纪念日还没填）或不是合法 `YYYY-MM-DD` → 返回 null，
 *   页面据此显示「待填」，不要拿 0 冒充一个不知道的日子；
 * - `iso` 落在未来时返回负数：不夹到 0，把错误数据藏起来比负数更糟。
 */
export function daysTogether(today: CalendarDate, iso: string | null): number | null {
  const from = parseIsoDate(iso);

  if (from === null) {
    return null;
  }

  return diffInDays(toUtc(from), toUtc(today));
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function toUtc(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function diffInDays(fromUtc: number, toUtc: number): number {
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}
