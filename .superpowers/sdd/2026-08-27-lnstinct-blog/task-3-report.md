# Task 3 报告：数据层与权限

日期：2026-08-27
状态：静态代码完成；远程集成测试未执行（无 Supabase 凭据，按要求标注）

## 交付内容

- 本地文件存储 `src/lib/store/files.ts`：`data/*.json` 原子写（临时文件 + rename），刻意无进程内缓存保证读写一致性。
- `src/lib/content/file-repository.ts`：公开读（published 过滤）+ `AdminContentRepository` 全 CRUD；写操作再次 Zod 校验；slug 唯一；单 ID 删除（无批量）。
- `src/lib/content/data-source.ts`：`getContentDataSource()` 按环境切换——配置了 `NEXT_PUBLIC_SUPABASE_URL` + anon key 时走 Supabase 公开读仓储，否则本地文件仓储。
- `src/lib/content/supabase-repository.ts` + `src/lib/supabase/client.ts`：匿名公开读实现（RLS 只读 published）；应用不持有 service-role key，无注册入口。
- `supabase/migrations/0001_init.sql`：posts / projects / admin_users；updated_at 触发器；slug 唯一；check 约束；RLS（匿名读 published，`is_admin(auth.uid())` 管理员全量）；`draft-media` 私有、`public-media` 公开的 Storage 策略。
- 图片校验 `src/lib/media/validate.ts`：JPEG/PNG/WebP/AVIF、≤5 MiB、安全随机文件名；纯函数 + 单测。
- 后台认证 `src/lib/auth/session.ts` / `server.ts`：`ADMIN_PASSWORD`（未配置时文档化开发默认值）+ HMAC-SHA256 签名 httpOnly 会话 cookie；`requireAdmin()` 供所有后台路由与 Server Action 复用。

## 验证

- 单测覆盖：mapper/缺环境降级/公开筛选/管理员保护/媒体校验（`tests/media-validate.test.ts`、`tests/session.test.ts`、`tests/file-repository.test.ts`、`tests/tiptap-content.test.ts` 等）。
- 缺 Supabase 环境：页面可构建，公开站返回本地数据，后台显示配置说明。
- `npm run test` / `lint` / `typecheck` / `build` 全部通过。

## 未执行项（明确标注）

- **远程 Supabase RLS/Storage 集成测试未执行**：本机没有任何 Supabase 项目与凭据，无法对真实实例验证 RLS 与存储策略；`0001_init.sql` 仅做了静态审查。
- 无凭据时不实例化 Supabase 仓储（`hasSupabaseConfig()` 为 false），本地文件仓储承担验收期数据层职责。
