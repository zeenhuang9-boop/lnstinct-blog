import { createBrowserClient } from '@supabase/ssr';

/**
 * 公开匿名读客户端：只用于读取 RLS 允许的公开数据。
 * 应用不持有 service-role key，也没有注册入口，后台不依赖此客户端。
 */
export function createPublicClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
