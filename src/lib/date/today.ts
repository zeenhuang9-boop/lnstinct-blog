import type { CalendarDate } from './birthday';

/**
 * 唯一的「今天」来源：固定 Asia/Shanghai，和全站日期显示口径一致（见 `src/lib/date-time.ts`）。
 *
 * 系统时间只在这个文件里读，日期计算全部是 `./birthday.ts` 里的纯函数。
 * 传 `now` 只用于测试：生产代码不传，取系统当前时刻。
 */
const chinaDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInShanghai(now: Date = new Date()): CalendarDate {
  const parts = Object.fromEntries(
    chinaDateFormatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/** 与 `todayInShanghai` 是同一个函数，只是换个说法；两个名字都可以用。 */
export const todayInChina = todayInShanghai;
