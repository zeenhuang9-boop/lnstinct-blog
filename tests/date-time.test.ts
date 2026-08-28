import { describe, expect, it } from 'vitest';

import { formatChinaDateTime } from '@/lib/date-time';

describe('formatChinaDateTime', () => {
  it('按中国标准时间显示跨过 UTC 日期边界的发布时间', () => {
    expect(formatChinaDateTime('2026-08-27T16:30:45.000Z')).toBe('2026-08-28 00:30:45');
  });

  it('始终保留到秒', () => {
    expect(formatChinaDateTime('2026-08-28T03:04:05.000Z')).toBe('2026-08-28 11:04:05');
  });
});
