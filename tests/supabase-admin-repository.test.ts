import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseAdminContentRepository } from '@/lib/content/supabase-admin-repository';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin-client', () => ({
  createAdminClient: mocks.createAdminClient,
}));

describe('Supabase admin repository', () => {
  beforeEach(() => {
    mocks.createAdminClient.mockReset();
  });

  it('updatePost sends the changed kind to Supabase', async () => {
    const existingRow = {
      id: 'post-1',
      slug: 'old-title',
      kind: 'article',
      title: 'Old title',
      summary: null,
      content: { type: 'doc', content: [] },
      tags: [],
      status: 'draft',
      published_at: null,
      created_at: '2026-08-28T00:00:00.000Z',
      updated_at: '2026-08-28T00:00:00.000Z',
    };
    let updatePatch: Record<string, unknown> | null = null;

    const fakeClient = {
      from: () => ({
        select: (columns: string) => columns === 'slug'
          ? Promise.resolve({ data: [{ slug: existingRow.slug }], error: null })
          : {
              eq: () => ({
                maybeSingle: async () => ({ data: existingRow, error: null }),
              }),
            },
        update: (patch: Record<string, unknown>) => {
          updatePatch = patch;
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({ data: { ...existingRow, ...patch }, error: null }),
              }),
            }),
          };
        },
      }),
    };

    mocks.createAdminClient.mockReturnValue(fakeClient);
    const repository = createSupabaseAdminContentRepository();

    await repository?.updatePost('post-1', {
      kind: 'learning',
      title: 'New title',
      summary: undefined,
      content: { type: 'doc', content: [] },
      tags: [],
    });

    expect(updatePatch).toMatchObject({ kind: 'learning', title: 'New title' });
  });
});
