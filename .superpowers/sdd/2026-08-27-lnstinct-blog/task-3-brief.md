# Task 3：Supabase 数据、权限与仓储

先阅读计划、ledger、Task 1 类型契约和 Task 2 的 `contentRepository` 接口。

## 交付目标

1. 先写仓储、环境检查和行映射测试，再实现代码。
2. 精确安装并锁定经审查的官方包：`@supabase/supabase-js@2.112.4`、`@supabase/ssr@0.12.4`，安装继续使用 `--ignore-scripts`。
3. 提供浏览器、Server Component/Action 使用的 Supabase client；cookie session 遵循官方 SSR 模式。缺失环境变量时公共站返回空数据，后台显示配置说明，不崩溃、不伪造会话。
4. 新增可审计 SQL migrations：
   - `posts`、`projects`、`admin_users`，字段与 Task 1 snake_case row 类型完全一致。
   - 自动维护 `updated_at`；slug 唯一；枚举/check constraints 与应用状态一致。
   - 启用 RLS：匿名只读 published；管理员通过 `is_admin(auth.uid())` 写入和读取草稿；普通认证用户无写权限。
   - `draft-media` 私有、`public-media` 公开；只有管理员能上传/移动/删除。
   - 不允许客户端公开注册；应用不持有 service role key。
5. 实现 Post/Project 仓储：公开列表/详情、管理员列表/详情、新增、更新、状态转换、单 ID 删除。所有写操作再次验证管理员。
6. 图片上传校验：JPEG/PNG/WebP/AVIF，最大 5 MiB，安全文件名；失败不得清空正文草稿。
7. `.env.example` 只写变量名和假值；任何真实密钥都不得入库。

## 验证

- 单测覆盖 mapper、缺环境降级、公开筛选、管理员保护、MIME/大小校验。
- 静态审查 SQL 的 RLS/Storage policy；若没有 Supabase 凭据，明确标注未执行远程集成测试。
- `npm run test && npm run lint && npm run typecheck && npm run build`
- 报告写入 `task-3-report.md`。

你不是唯一参与者，不得撤销其他修改；不得触碰 git 备份、部署、push 或写外部账号。

