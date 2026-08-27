import type { ContentRepository } from '@/lib/content/repository';
import { createFileContentRepository } from '@/lib/content/file-repository';

let fileRepository: ContentRepository | null = null;
let supabaseRepository: ContentRepository | null = null;

/** 是否配置了可用的 Supabase 公开连接。 */
export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return Boolean(url && anonKey);
}

/**
 * 运行时数据源：优先 Supabase（配置了公开 URL + anon key 时），否则使用本地文件存储。
 * 本地文件存储保证“上传文章 → 公开页面可见”在无云端依赖时也可用。
 */
export async function getContentDataSource(): Promise<ContentRepository> {
  if (hasSupabaseConfig()) {
    if (!supabaseRepository) {
      const { createSupabaseContentRepository } = await import('@/lib/content/supabase-repository');
      supabaseRepository = createSupabaseContentRepository();
    }

    return supabaseRepository as ContentRepository;
  }

  if (!fileRepository) {
    fileRepository = createFileContentRepository();
  }

  return fileRepository as ContentRepository;
}
