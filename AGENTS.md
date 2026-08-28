# AGENTS.md — lnstinct-blog 项目记忆

> 本文件是项目的唯一持久记忆：更换 AI、压缩上下文或新会话开始时，先完整阅读本文件。
> 项目根目录：`E:\我的个人博客`

## 0. 一句话状态（最后更新：2026-08-28）

**本地全功能博客已完成并验收，且已成功部署到公网**：公开站点 + 手机写作后台 + 本地文件存储 + Supabase 就绪迁移。
已通过真实浏览器（Edge 桌面 + 390px 手机）走通「登录 → 写作（含图片上传）→ 发布 → 公开页显示无误」，
站点保留一篇真实首篇文章《站点手记：纸上生长》。公开地址：`https://lnstinct-blog.vercel.app/`；2026-08-27 10:07 已直接验证首页、学习记录、文章、项目、关于、后台登录、RSS、robots、sitemap 均返回 HTTP 200。

站内结构（用户最新要求）：导航 = 主页 | 学习记录 | 文章 | 项目 | 关于；内容类型 = 文章 / 学习记录；
列表页无搜索、无标签，按发布时间倒序；/learning 为专业学习文章区（每天的学习内容写成文章放这里），
/essays 旧路径重定向到 /learning。

2026-08-28 更新：编辑器支持富文本/Markdown 双模式；所有文章时间按 `Asia/Shanghai` 显示到秒；
文章与学习记录可自由切换并持久化；后台不再使用“散文”文案；首页关于区两个按钮已移除。
功能提交 `a8dbad6` 已推送并由 Vercel 自动部署；19:50 线上公开路由与两项可观察改动核验通过。

验证基线（最近一次全量，全部 PASS）：
- `npm run test`：21 个测试文件 / 110 个测试通过
- `npm run lint`、`npm run typecheck`、`npm run build`：通过
- `npm audit --audit-level=high`：0 漏洞
- `npx playwright test`：28/28 通过；生产模式 `next build && next start` 冒烟通过
- 隐私扫描：公开页面无真实姓名/学校/联系方式/密钥

## 1. 目标（已完成）

完成 lnstinct 个人博客直到可以完整使用：登录后台 → 写作（含图片）→ 发布 → 公开页面正确显示。

## 2. 绝对约束

- 公开身份只允许「小泽 / lnstinct.」；不得出现真实姓名、学校名称、手机号、QQ、私人邮箱、家庭信息。
- 协会经历只写「数学建模协会负责人」。
- 所有项目文件只在 `E:\我的个人博客`；不向 C 盘创建资产。
- 禁止批量删除文件/目录；只能单文件明确删除。
- 不提供评论、公开注册、定时发布、多人协作、访问统计后台或批量删除。
- 公网部署已由用户完成；后续生产环境变量、数据库、内容或部署变更仍需明确授权并在修改后验证。
- `git-metadata-sandbox-backup` 是空仓库元数据备份；不要恢复/递归移动/批量删除。重新 `git init` 需用户授权。
- 不要求用户粘贴密码/密钥；引导其写入本机 `.env.local`。

## 3. 技术栈（已锁定）

Next.js 16.3.2（App Router、Turbopack）、React 19.2.8、TypeScript 5.9.3、Tailwind 4.3.3、
Vitest 4.1.11 + Testing Library、Playwright 1.62.1（系统 Edge channel，不下载浏览器）、
Tiptap 全部 3.30.5（含官方 Beta Markdown 扩展）、zod 4.4.3、@supabase/supabase-js 2.112.4 + @supabase/ssr 0.12.4（未配置时不启用）。

## 4. 架构

```
app/                公开站页面 + admin（login 在受保护布局外；(dashboard) 布局统一 requireAdmin）
src/
  config/site.ts     # siteConfig：name/author/description/url（NEXT_PUBLIC_SITE_URL，默认 localhost:3000）
  domain/            # Task 1 领域契约：types/content-status/input-schemas/tiptap-content（含 image）
  lib/store/files.ts # data/*.json 原子写；刻意无进程内缓存（Turbopack dev 多实例会缓存不一致）
  lib/content/       # repository.ts / file-repository.ts / data-source.ts / supabase-repository.ts / filter.ts / types.ts
  lib/date-time.ts   # 固定 Asia/Shanghai，格式化到秒
  lib/auth/          # session.ts（HMAC 签名 httpOnly cookie）+ server.ts（requireAdmin）
  lib/media/validate.ts  # JPEG/PNG/WebP/AVIF ≤5MiB 纯函数校验
  lib/actions/       # auth/posts/projects/media Server Actions
supabase/migrations/0001_init.sql
data/  public/media/ # 用户数据（gitignore）
e2e/                 # aa-empty-state / admin / blog-flow / zz-public + global-setup + helpers
tests/               # 21 文件 110 测试
```

关键行为：
- 公开页全部 `force-dynamic`，读 `getContentDataSource()`（Supabase 配置存在走云端，否则本地文件）。
- 非 ASCII slug：Next 16.3 Turbopack 动态段传未解码值，`app/articles/[slug]/page.tsx` 等做 `decodeSlugParam`（生产 `next start` 已验证中文 slug 正常）。
- Tiptap Image 3.30.5 输出 attrs `src/alt/title/width/height`（默认 null），白名单已按真实输出放宽并加回归测试。
- E2E `globalSetup` 每轮重置 `data/*.json`；文件按 `aa-`（空状态，先跑）/`zz-`（数据无关，后跑）排序避免数据依赖。

## 5. 常用命令

- 全量验证：`npm run test && npm run lint && npm run typecheck && npm run build`
- E2E：`npx playwright test`（先确保没有残留的 next 进程占用 3000 端口）
- 启动：`npm run dev`；生产：`npm run build && npm run start`
- 后台登录：`/admin/login`；未配置 `ADMIN_PASSWORD` 时默认密码 `lnstinct-dev`

## 6. 下一步（如继续）

1. 确认 Vercel 已配置 Supabase 正式环境并执行 `0001_init.sql` + 远程 RLS 测试；若仍回退到本地 JSON，Vercel 运行时写入不应视为可靠持久化。
2. 完成一次生产后台「登录 → 新建草稿 → 发布 → 刷新/重新部署后仍存在」验证；这是生产写作闭环，执行前需用户授权，因为会改动公网内容。
3. 可选：通过 GitHub 官方 API 导入真实项目（Task 5 未做项目导入，`/projects` 为空状态）。

## 7. 参考

- 总计划：`docs/superpowers/plans/2026-08-27-lnstinct-blog.md`
- SDD ledger：`.superpowers/sdd/2026-08-27-lnstinct-blog/progress.md`
- README：`README.md`；交接：`HANDOFF.md`；验收截图：`test-results/final-*.png`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
