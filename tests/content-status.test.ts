import { describe, expect, it } from 'vitest';

import { transitionStatus } from '@/domain/content-status';

describe('transitionStatus', () => {
  it('publishes a draft', () => {
    expect(transitionStatus('draft', 'publish')).toBe('published');
  });

  it('moves published content back to draft when withdrawn', () => {
    expect(transitionStatus('published', 'withdraw')).toBe('draft');
  });

  it('restores trashed content to draft', () => {
    expect(transitionStatus('trashed', 'restore')).toBe('draft');
  });

  it('rejects an unavailable transition with a clear error', () => {
    expect(() => transitionStatus('draft', 'restore')).toThrow('Cannot restore draft content');
  });
});
