# SDD ledger — plan: E:\我的个人博客\docs\superpowers\plans\2026-08-27-lnstinct-blog.md

## Pre-flight interface scan

| Tasks | Shared interface | Finding / ruling |
|---|---|---|
| 1 → 2 | Domain types, site config, validation | Public pages consume only Task 1 exports; no conflict. |
| 1 → 3 | Post/project schemas | SQL and repository types must match Task 1 names exactly. |
| 2 → 3 | Content data source | Public UI receives repository results and must retain empty states when Supabase is absent. |
| 3 → 4 | Auth, repositories, status transitions | Admin uses RLS-backed repositories; no service-role secret in application code. |
| 2 → 4 | Shared design system | Admin reuses tokens but uses denser controls; public editorial layout remains separate. |
| 3 → 5 | Migrations and environment | README documents exact migration and admin bootstrap steps. |

Ruling: The approved design mentioned a `profiles` data model once, but also fixed homepage/about content in code. Use typed `siteConfig` and do not create a profiles table, matching the explicit CMS scope.

Ruling: Local acceptance may connect to a private Supabase project, but the repository must still build and render public empty states without secrets so automated checks remain reproducible.

Ruling: Deployment and public GitHub creation are outside the local acceptance phase and will not be executed in this run.

## Task 1 review

- Initial verification: 5 test files / 17 tests passed; lint, typecheck and build exited 0; full npm audit reported 0 vulnerabilities.
- Review round 1: spec FAIL, quality FAIL. Required fixes: pin Supabase/Tiptap, restrict project URLs, strengthen Tiptap structure checks, broaden env ignores, ignore tsbuildinfo.
- Ruling: The first Task 1 RED run failed because dependencies were unavailable rather than because the domain behavior was missing. This historical process evidence cannot be recreated honestly. Record it as a non-code process limitation; every added behavior from review round 2 onward must demonstrate a real expected RED before implementation.

- Fix round 2: restricted project URL protocols, strengthened environment ignores, pinned official Supabase/Tiptap packages, and added structural tests.
- Fix round 3: added strict Tiptap parent-child grammar; fresh verification passed 5 files / 39 tests plus lint, typecheck and build.
- Final scoped reviewer wait was interrupted before its verdict. Task 1 is implemented but not marked complete until the next AI performs that final read-only review.

## Pause / handoff

- Work paused at the user's request because the remaining usage quota may be insufficient.
- Canonical continuation document: `E:\我的个人博客\HANDOFF.md`.
- Do not continue implementation until a new AI reads HANDOFF.md and re-runs the verification commands recorded there.

## Task 1 final review（补充）

- 下一轮只读复审：`src/domain/tiptap-content.ts` 与 `tests/tiptap-content.test.ts` 无新的 Critical/High/Medium 问题；Task 1 记为 complete。

## Task 2 review（公开站点）

- 实现：路由 `/` `/projects` `/articles` `/articles/[slug]` `/essays` `/essays/[slug]` `/about` 404、robots、sitemap、RSS；hero/关于/精选项目/最新文章/散文；`?q=` 与 `?tag=` 查询；阅读进度、分享/复制回退；亮暗主题（localStorage + 内联脚本防闪烁）；暖纸/墨黑/锈红色板与系统字体栈；诚实空状态。
- 修复：`tests/setup.ts` 显式 `afterEach(cleanup)`；`site-header` 用 `next/link`；`theme-toggle` 改为 `useSyncExternalStore`（消除 setState-in-effect lint）；`post-list` 空状态 props 可选；`share-actions` 客户端挂载后再判定 `navigator.share`（修复 SSR/水合不一致）。
- 验收：94 单测 + 24 E2E 全通过；lint/typecheck/build 通过；桌面与 390px 手机视口浏览器验证通过。

## Task 3 review（数据层与权限）

- 实现：本地文件存储 `src/lib/store/files.ts`（原子写、无进程内缓存）；`file-repository.ts` 公开读 + AdminContentRepository 全 CRUD（Zod 校验、slug 唯一、单 ID 删除）；`data-source.ts` 按环境切换 Supabase/本地；`supabase-repository.ts` + `supabase/client.ts` 静态实现；`supabase/migrations/0001_init.sql`（posts/projects/admin_users + RLS + Storage 策略）。
- 图片校验：`src/lib/media/validate.ts`（JPEG/PNG/WebP/AVIF、≤5 MiB）纯函数 + 测试。
- 已知限制：无 Supabase 凭据，远程 RLS/Storage 集成测试**未执行**（按要求标注）；应用不持有 service-role key，无公开注册。

## Task 4 review（手机写作后台）

- 实现：`/admin/login`（密码 + HMAC 签名 httpOnly 会话）；`/admin` 仪表盘；`/admin/posts` 列表（状态筛选）、`/new`、`/[id]`；Tiptap 编辑器（H1–H3、加粗/斜体/删除线/行内代码、引用、列表、代码块、链接、图片上传）；自动保存（保存中/已保存/保存失败）；保存草稿 → 预览 → 发布/撤回 → 回收站恢复 → 二次确认单条永久删除；`/admin/projects` 增删改与精选。
- 安全：所有后台路由与 Server Actions 独立 `requireAdmin()`；富文本白名单扩展 image 节点（attrs 白名单 + 安全 src），保存再次校验。
- 修复的关键问题：Tiptap 3.30.5 Image 节点输出 5 个 attrs（含 width/height:null）导致白名单拒绝——已按真实输出调整并加回归测试；Next 16.3 Turbopack 对非 ASCII 动态段传未解码值——详情页 `decodeSlugParam` 修复；本地文件存储去掉进程内缓存——避免 Turbopack dev 多实例缓存导致的“写入后读到旧数据”。

## Task 5 review（文档与验收）

- README、HANDOFF、AGENTS.md、报告已更新；`.env.example` 补齐 ADMIN_PASSWORD/ADMIN_SESSION_SECRET/NEXT_PUBLIC_SITE_URL。
- E2E（`e2e/`）：aa-empty-state（空状态）、admin.spec（后台全流程）、blog-flow.spec（用户目标流程：登录→写作→传图→发布→显示→撤回→回收→恢复→删除→清理）、zz-public（导航/404/RSS/robots，桌面+手机）；globalSetup 每轮重置本地数据保证可重复。
- 真实浏览器验收：登录、新建文章（含图片上传）、发布、列表/首页/详情显示无误，桌面 + 390px 手机截图留存于 `test-results/final-*.png`。
- 隐私扫描：公开页面 HTML 无真实姓名/学校/联系方式（扫描命中均为 UUID 片段与“手机阅读”等普通词）。
- 生产模式：`next build && next start` 后文章详情/列表/RSS 均 200；`npm audit` 0 漏洞。

## 当前结论

- 本地全功能博客已完成并验收：公开站点 + 手机写作后台 + 本地存储 + Supabase 就绪迁移；94 单测 + 24 E2E 全绿；构建/审计通过；已通过真实浏览器上传一篇真实文章并确认公开显示无误。
- 未执行：Supabase 远程集成（无凭据）、公开 GitHub/Vercel 部署（本地验收前禁止）。
