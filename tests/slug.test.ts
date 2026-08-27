import { describe, expect, it } from 'vitest';

import { slugifyTitle } from '@/lib/slug';

describe('slugifyTitle', () => {
  it('normalizes English words into lowercase hyphen-separated slugs', () => {
    expect(slugifyTitle('  Hello, World!  ')).toBe('hello-world');
  });

  it('preserves Chinese characters while normalizing adjacent English text', () => {
    expect(slugifyTitle('我的 First Post')).toBe('我的-first-post');
  });

  it('uses a stable fallback when the input has no usable characters', () => {
    expect(slugifyTitle('---')).toBe('untitled');
  });
});
