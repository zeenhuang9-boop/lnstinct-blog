/** 日期逻辑的入口：纯函数在 `./birthday`，读系统时间在 `./today`。 */
export {
  daysInMonth,
  daysTogether,
  describeBirthday,
  occurrenceOf,
  parseIsoDate,
} from './birthday';
export type { BirthdaySummary, CalendarDate, MonthDay } from './birthday';
export { todayInChina, todayInShanghai } from './today';
