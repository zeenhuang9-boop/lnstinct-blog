import type { AdminContentRepository } from '@/lib/content/types';
import { createFileContentRepository } from '@/lib/content/file-repository';

/**
 * 后台管理仓储：优先 Supabase（配置了 service-role key），否则回退本地文件存储。
 * 本地开发未配置 service-role key 时，行为与之前完全一致。
 * 刻意不做进程内缓存（与 data-source 一致，避免 Turbopack dev 多实例缓存不一致）。
 */
export async function getAdminContentRepository(): Promise<AdminContentRepository> {
  const { createSupabaseAdminContentRepository } = await import('@/lib/content/supabase-admin-repository');
  const supabaseRepository = createSupabaseAdminContentRepository();

  if (supabaseRepository) {
    return supabaseRepository;
  }

  return createFileContentRepository();
}
