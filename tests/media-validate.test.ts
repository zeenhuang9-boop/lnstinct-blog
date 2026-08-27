import { describe, expect, it } from 'vitest';

import { MAX_MEDIA_SIZE_BYTES, validateImageUpload } from '@/lib/media/validate';

describe('validateImageUpload', () => {
  it('accepts supported image types', () => {
    expect(validateImageUpload({ type: 'image/jpeg', size: 100 })).toEqual({ ok: true, extension: '.jpg' });
    expect(validateImageUpload({ type: 'image/png', size: 100 })).toEqual({ ok: true, extension: '.png' });
    expect(validateImageUpload({ type: 'image/webp', size: 100 })).toEqual({ ok: true, extension: '.webp' });
    expect(validateImageUpload({ type: 'image/avif', size: 100 })).toEqual({ ok: true, extension: '.avif' });
  });

  it('rejects non-image MIME types', () => {
    const result = validateImageUpload({ type: 'text/html', size: 100 });

    expect(result.ok).toBe(false);
  });

  it('rejects empty files', () => {
    const result = validateImageUpload({ type: 'image/png', size: 0 });

    expect(result.ok).toBe(false);
  });

  it('rejects files over 5 MiB', () => {
    const result = validateImageUpload({ type: 'image/png', size: MAX_MEDIA_SIZE_BYTES + 1 });

    expect(result.ok).toBe(false);
  });

  it('accepts files exactly at the 5 MiB limit', () => {
    const result = validateImageUpload({ type: 'image/png', size: MAX_MEDIA_SIZE_BYTES });

    expect(result.ok).toBe(true);
  });
});
