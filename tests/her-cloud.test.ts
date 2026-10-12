import { describe, expect, it } from 'vitest';

import { herProfile } from '@/content/her';
import { HerCloudError, createHerSupabaseStore, type HerCloudStore } from '@/lib/content/her-cloud';
import { getHerProfile, readHerProfile, saveHerProfile } from '@/lib/content/her-source';

/**
 * 「她」内容上云（Supabase `her_profile` 表）后的行为。
 *
 * 这些用例**不连真库**：用一个假客户端顶替 PostgREST 的链式调用，
 * 断言的是「云端有内容就用云端 / 云端空或坏掉怎么降级 / 保存往哪写」这三件事。
 * 真链路的验证在线上做（见 docs/her-page-roadmap.md 的验收章节）。
 */

type TableBehaviour = {
  readonly row?: unknown;
  readonly selectError?: { code?: string; message?: string };
  readonly upsertError?: { code?: string; message?: string };
  readonly lastUpsert?: { row: unknown };
};

/** 假客户端：只实现本模块用到的 `from().select().eq().maybeSingle()` 与 `from().upsert()`。 */
function fakeClient(behaviour: TableBehaviour) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: behaviour.selectError ? null : (behaviour.row ?? null),
                    error: behaviour.selectError ?? null,
                    table,
                  };
                },
              };
            },
          };
        },
        async upsert(row: unknown) {
          if (behaviour.lastUpsert) {
            behaviour.lastUpsert.row = row;
          }

          return { error: behaviour.upsertError ?? null };
        },
      };
      // 说明：上面的对象形状与 supabase-js 的链式 builder 对齐到「本模块实际用到的部分」。
    },
  };
}

/** 只测「注入的 store」这条路径，不依赖环境变量。 */
function storeWith(behaviour: TableBehaviour): HerCloudStore {
  return createHerSupabaseStore(
    fakeClient(behaviour) as unknown as Parameters<typeof createHerSupabaseStore>[0],
  );
}

describe('云端有内容时：直接用它，不去碰本地文件', () => {
  it('读到合法内容 → source = cloud，且 timeline 被归一化成 iso 降序', async () => {
    const messy = {
      ...herProfile,
      displayName: '云端称呼',
      timeline: [
        { id: 'b', date: null, iso: null, title: '待填的', photos: [] },
        { id: 'a', date: '2026 · 10 · 12', iso: '2026-10-12', title: '有日期的', photos: [] },
      ],
    };

    const result = await readHerProfile(storeWith({ row: { data: messy } }));

    expect(result.source).toBe('cloud');
    expect(result.problem).toBeNull();
    expect(result.profile.displayName).toBe('云端称呼');
    expect(result.profile.timeline.map((event) => event.id)).toEqual(['a', 'b']);
  });

  it('getHerProfile 同样优先云端', async () => {
    const profile = await getHerProfile(storeWith({ row: { data: { ...herProfile, displayName: '云上的人' } } }));

    expect(profile.displayName).toBe('云上的人');
  });
});

describe('云端空或坏掉时的降级', () => {
  it('云端没有这一行 → 明确提示「云端是空的」，而不是说没有 her.json', async () => {
    const result = await readHerProfile(storeWith({ row: null }));

    expect(result.source).toBe('default');
    expect(result.problem?.kind).toBe('cloud');
    expect(result.problem?.message).toContain('云端是空的');
    expect(result.problem?.message).not.toContain('her.json');
  });

  it('表还没建（迁移没跑）→ 给出可执行的中文提示，不把英文报错丢给用户', async () => {
    const result = await readHerProfile(
      storeWith({ selectError: { code: '42P01', message: 'relation "public.her_profile" does not exist' } }),
    );

    expect(result.problem?.kind).toBe('cloud');
    expect(result.problem?.message).toContain('0002_her_profile.sql');
  });

  it('云端内容校验不过 → 回退默认内容，并说明是云端那份有问题', async () => {
    const result = await readHerProfile(storeWith({ row: { data: { ...herProfile, birthday: { month: 13, day: 1 } } } }));

    expect(result.source).toBe('default');
    expect(result.problem?.kind).toBe('invalid');
    expect(result.problem?.message).toContain('supabase:her_profile');
  });

  it('云端读取抛别的错也不崩：降级并说明原因', async () => {
    const failing: HerCloudStore = {
      label: 'supabase:her_profile',
      load: async () => {
        throw new HerCloudError('unavailable', 'Supabase 读写失败：网络断了');
      },
      save: async () => undefined,
    };

    const result = await readHerProfile(failing);

    expect(result.source).toBe('default');
    expect(result.problem?.message).toContain('网络断了');
  });
});

describe('保存往哪写', () => {
  it('配了云端 → 写 upsert，不写本地文件', async () => {
    const behaviour: TableBehaviour = { lastUpsert: { row: null } };
    const saved = await saveHerProfile({ ...herProfile, displayName: '写进云端' }, storeWith(behaviour));

    expect(saved.displayName).toBe('写进云端');
    expect(behaviour.lastUpsert?.row).toMatchObject({ slug: 'her' });
    expect((behaviour.lastUpsert?.row as { data: { displayName: string } }).data.displayName).toBe('写进云端');
  });

  it('云端 upsert 失败 → 抛出可读的错误（不静默当作成功）', async () => {
    await expect(
      saveHerProfile(
        herProfile,
        storeWith({ upsertError: { code: '42P01', message: 'relation "public.her_profile" does not exist' } }),
      ),
    ).rejects.toThrow(/0002_her_profile\.sql/);
  });
});
