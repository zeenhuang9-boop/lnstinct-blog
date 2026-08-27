import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 服务端管理客户端：使用 service-role key，绕过 RLS。
 * 仅供 Server Action / 服务端页面使用，绝不暴露到浏览器端。
 * 未配置 service-role key 时返回 null，由调用方回退到本地文件仓储。
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
