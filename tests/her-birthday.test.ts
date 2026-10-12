import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  daysInMonth,
  daysTogether,
  describeBirthday,
  parseIsoDate,
  type CalendarDate,
} from '@/lib/date/birthday';
import { todayInChina, todayInShanghai } from '@/lib/date/today';

/** 内容里真实的生日：10 月 11 日（`month` 从 1 开始）。 */
const HER_BIRTHDAY = { month: 10, day: 11 };

/** 测试用的「今天」：用 parseIsoDate 造，避免在测试里手写 UTC 偏移。 */
function on(iso: string): CalendarDate {
  const date = parseIsoDate(iso);

  if (date === null) {
    throw new Error(`测试数据写错了，这不是合法日期：${iso}`);
  }

  return date;
}

/** 期望值全部由 Date.UTC 独立算过一遍，不是照着实现反推的。 */
describe('describeBirthday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('年中：生日还没到，就在今年', () => {
    expect(describeBirthday(on('2026-06-15'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 118,
      nextOccurrenceYear: 2026,
    });
  });

  it('月首（3-01）：本月还没过生日，落在本月', () => {
    expect(describeBirthday(on('2026-03-01'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 224,
      nextOccurrenceYear: 2026,
    });
  });

  it('生日前一天：还差 1 天', () => {
    expect(describeBirthday(on('2026-10-10'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 1,
      nextOccurrenceYear: 2026,
    });
  });

  it('月首前一天（2 月底）：3 月 1 日的生日还差 1 天，不算到明年', () => {
    expect(describeBirthday(on('2026-02-28'), { month: 3, day: 1 })).toEqual({
      isToday: false,
      daysUntil: 1,
      nextOccurrenceYear: 2026,
    });
  });

  it('2 月底到 10 月生日：差 225 天（跨 3–9 月）', () => {
    expect(describeBirthday(on('2026-02-28'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 225,
      nextOccurrenceYear: 2026,
    });
  });

  it('月首当天就是生日：0 天，不算到明年', () => {
    expect(describeBirthday(on('2026-03-01'), { month: 3, day: 1 })).toEqual({
      isToday: true,
      daysUntil: 0,
      nextOccurrenceYear: 2026,
    });
  });

  it('生日当天：daysUntil = 0', () => {
    expect(describeBirthday(on('2026-10-11'), HER_BIRTHDAY)).toEqual({
      isToday: true,
      daysUntil: 0,
      nextOccurrenceYear: 2026,
    });
  });

  it('生日次日：顺延到下一年，364 天（2026、2027 都不是闰年）', () => {
    expect(describeBirthday(on('2026-10-12'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 364,
      nextOccurrenceYear: 2027,
    });
  });

  it('跨年：生日已过，数到明年', () => {
    expect(describeBirthday(on('2026-12-20'), HER_BIRTHDAY)).toEqual({
      isToday: false,
      daysUntil: 295,
      nextOccurrenceYear: 2027,
    });
  });

  it('跨年：1 月 1 日生日，除夕当天还差 1 天', () => {
    expect(describeBirthday(on('2026-12-31'), { month: 1, day: 1 })).toEqual({
      isToday: false,
      daysUntil: 1,
      nextOccurrenceYear: 2027,
    });
  });

  it('跨年且跨过闰日：12 月 1 日生日，次年间隔 365 天（2028 是闰年）', () => {
    expect(describeBirthday(on('2027-12-02'), { month: 12, day: 1 })).toEqual({
      isToday: false,
      daysUntil: 365,
      nextOccurrenceYear: 2028,
    });
  });

  describe('2 月 29 日的生日', () => {
    it('平年落到 2 月 28 日：那天就是生日，0 天', () => {
      expect(describeBirthday(on('2025-02-28'), { month: 2, day: 29 })).toEqual({
        isToday: true,
        daysUntil: 0,
        nextOccurrenceYear: 2025,
      });
    });

    it('平年的 2 月 27 日：还差 1 天', () => {
      expect(describeBirthday(on('2025-02-27'), { month: 2, day: 29 })).toEqual({
        isToday: false,
        daysUntil: 1,
        nextOccurrenceYear: 2025,
      });
    });

    it('平年 3 月 1 日：已经过了，顺延到下一年的 2 月 28 日', () => {
      expect(describeBirthday(on('2025-03-01'), { month: 2, day: 29 })).toEqual({
        isToday: false,
        daysUntil: 364,
        nextOccurrenceYear: 2026,
      });
    });

    it('闰年落在真正的 2 月 29 日', () => {
      expect(describeBirthday(on('2024-02-29'), { month: 2, day: 29 })).toEqual({
        isToday: true,
        daysUntil: 0,
        nextOccurrenceYear: 2024,
      });
    });

    it('闰年的 2 月 28 日：还差 1 天', () => {
      expect(describeBirthday(on('2024-02-28'), { month: 2, day: 29 })).toEqual({
        isToday: false,
        daysUntil: 1,
        nextOccurrenceYear: 2024,
      });
    });
  });

  it('是纯函数：把系统时间改到别的年份，输出一个字都不变', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    const first = describeBirthday(on('2026-06-15'), HER_BIRTHDAY);

    vi.setSystemTime(new Date('1999-06-06T00:00:00.000Z'));
    const second = describeBirthday(on('2026-06-15'), HER_BIRTHDAY);

    expect(second).toEqual(first);
    expect(first.daysUntil).toBe(118);
  });
});

describe('daysInMonth', () => {
  it('闰年规则与 Date 一致（含百年与四百年）', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it('大小月', () => {
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('daysTogether', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('同一天是 0 天', () => {
    expect(daysTogether(on('2026-10-12'), '2026-10-12')).toBe(0);
  });

  it('数出整数天数差', () => {
    expect(daysTogether(on('2026-10-18'), '2026-10-12')).toBe(6);
  });

  it('跨年照样是整数天数差', () => {
    expect(daysTogether(on('2027-01-01'), '2026-12-31')).toBe(1);
  });

  it('纪念日没填（null）时返回 null：页面显示「待填」，不拿 0 冒充', () => {
    expect(daysTogether(on('2026-10-12'), null)).toBeNull();
  });

  it('不是合法 YYYY-MM-DD 时返回 null，不返回 NaN', () => {
    expect(daysTogether(on('2026-10-12'), '待填')).toBeNull();
    expect(daysTogether(on('2026-10-12'), '')).toBeNull();
    expect(daysTogether(on('2026-10-12'), '2026/10/12')).toBeNull();
    expect(daysTogether(on('2026-10-12'), '2026-13-01')).toBeNull();
    expect(daysTogether(on('2026-10-12'), '2026-02-30')).toBeNull();
  });

  it('纪念日在未来时返回负数（不夹到 0）', () => {
    expect(daysTogether(on('2026-10-11'), '2026-10-12')).toBe(-1);
  });

  it('是纯函数：系统时间变了，结果不变', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    const first = daysTogether(on('2026-10-18'), '2026-10-12');

    vi.setSystemTime(new Date('1999-06-06T00:00:00.000Z'));
    expect(daysTogether(on('2026-10-18'), '2026-10-12')).toBe(first);
    expect(first).toBe(6);
  });
});

describe('parseIsoDate', () => {
  it('解析合法日期，并允许前后空格', () => {
    expect(parseIsoDate('2026-10-12')).toEqual({ year: 2026, month: 10, day: 12 });
    expect(parseIsoDate(' 2026-10-12 ')).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it('格式不对或日期不存在时返回 null', () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate('2026-1-2')).toBeNull();
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2025-02-29')).toBeNull();
  });

  it('闰日能被解析', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });
});

describe('todayInShanghai', () => {
  it('按 Asia/Shanghai 算日期：UTC 17:00 已经是上海的第二天', () => {
    expect(todayInShanghai(new Date('2026-10-11T17:00:00.000Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 12,
    });
  });

  it('UTC 15:59 还停在上海的当天', () => {
    expect(todayInShanghai(new Date('2026-10-11T15:59:59.000Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 11,
    });
  });

  it('不传参数时读系统时间：只检查它给出一个合法日期', () => {
    const today = todayInShanghai();

    expect(Number.isInteger(today.year)).toBe(true);
    expect(today.month).toBeGreaterThanOrEqual(1);
    expect(today.month).toBeLessThanOrEqual(12);
    expect(today.day).toBeGreaterThanOrEqual(1);
    expect(today.day).toBeLessThanOrEqual(daysInMonth(today.year, today.month));
  });

  it('todayInChina 是同一个函数的别名', () => {
    expect(todayInChina).toBe(todayInShanghai);
  });
});
