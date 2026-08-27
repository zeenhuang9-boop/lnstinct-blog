import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/config/site';

describe('siteConfig', () => {
  it('exposes only the approved public identity', () => {
    expect(siteConfig.author).toBe('小泽');
    expect(siteConfig.name).toBe('lnstinct.');
  });

  it('does not expose private identity data', () => {
    const publicValues = JSON.stringify(siteConfig);

    expect(publicValues).not.toMatch(/武汉|大学|@|电话|手机|家庭/);
  });
});
