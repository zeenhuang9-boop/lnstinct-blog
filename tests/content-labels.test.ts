import { describe, expect, it } from 'vitest';

import { postKindLabel } from '@/lib/content/labels';

describe('postKindLabel', () => {
  it('将 learning 显示为学习记录', () => {
    expect(postKindLabel('learning')).toBe('学习记录');
  });

  it('将 article 显示为文章', () => {
    expect(postKindLabel('article')).toBe('文章');
  });
});
