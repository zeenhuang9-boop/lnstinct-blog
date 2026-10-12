import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin-client';

/**
 * 「她」的内容在 Supabase 里的存储：单行、key-value 风格。
 *
 * 为什么要有这一层：本地开发写 `data/her.json` 就够了，但线上（Vercel）的文件系统是临时的
 * —— 后台改完，下一次请求或重新部署就回到代码里的默认内容。文章/项目早就是这样处理的
 * （`supabase-repository.ts`），这里给「她」补上同一件事。
 *
 * 三条边界：
 * - **表还不存在时不崩**：迁移没跑之前，读/写都返回 `table_missing`，由 `her-source.ts`
 *   降级到本地文件并在后台给出明确提示，而不是让保存直接抛一串英文。
 * - **形状仍由 zod 把关**：数据库只存 jsonb，不重复定义字段（两处 schema 必然漂移）。
 * - **不做进程内缓存**：与文件存储一致，避免「刚保存完，页面还是旧内容」。
 */

const TABLE = 'her_profile';
const SLUG = 'her' as const;

/** 云端出了问题时的分类：`table_missing` 表示迁移还没跑，其余归 `unavailable`。 */
export type HerCloudProblemKind = 'table_missing' | 'unavailable';

export class HerCloudError extends Error {
  readonly kind: HerCloudProblemKind;

  constructor(kind: HerCloudProblemKind, message: string) {
    super(message);
    this.name = 'HerCloudError';
    this.kind = kind;
  }
}

export type HerCloudLoad =
  | { readonly status: 'found'; readonly raw: unknown }
  | { readonly status: 'empty' };

export type HerCloudStore = {
  readonly label: string;
  load(): Promise<HerCloudLoad>;
  save(raw: unknown): Promise<void>;
};

/** PostgreSQL/PostgREST 的「表不存在」类错误码；命中就走 table_missing 分支。 */
function isMissingTable(error: { readonly code?: string; readonly message?: string }): boolean {
  const code = error.code ?? '';
  const message = error.message ?? '';

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|Could not find the table|relation .* does not exist/i.test(message)
  );
}

function toCloudError(error: { readonly code?: string; readonly message?: string }): HerCloudError {
  if (isMissingTable(error)) {
    return new HerCloudError(
      'table_missing',
      `Supabase 里还没有 ${TABLE} 表：请在 SQL Editor 里执行 supabase/migrations/0002_her_profile.sql。`,
    );
  }

  return new HerCloudError('unavailable', `Supabase 读写失败：${error.message ?? '未知错误'}`);
}

export function createHerSupabaseStore(db: SupabaseClient): HerCloudStore {
  return {
    label: `supabase:${TABLE}`,

    async load(): Promise<HerCloudLoad> {
      const { data, error } = await db.from(TABLE).select('data').eq('slug', SLUG).maybeSingle();

      if (error !== null) {
        throw toCloudError(error);
      }

      if (data === null || data === undefined) {
        return { status: 'empty' };
      }

      return { status: 'found', raw: (data as { data: unknown }).data };
    },

    async save(raw: unknown): Promise<void> {
      const { error } = await db
        .from(TABLE)
        .upsert({ slug: SLUG, data: raw, updated_at: new Date().toISOString() }, { onConflict: 'slug' });

      if (error !== null) {
        throw toCloudError(error);
      }
    },
  };
}

/**
 * 生产入口：配了 Supabase（公开 URL + service-role key）就返回云端存储，否则返回 null。
 * 页面与 Server Action 都通过它判断「这次是上云还是写本地」。
 */
export function getHerCloudStore(): HerCloudStore | null {
  const db = createAdminClient();

  return db === null ? null : createHerSupabaseStore(db);
}
