# lnstinct-blog 交接文档（本地验收完成）

> 更新时间：2026-08-27 06:20（Asia/Shanghai）
> 项目根目录：`E:\我的个人博客`
> 状态：**本地全功能博客已完成并通过真实浏览器验收**；未创建公开仓库/未部署（本地验收前禁止）。

## 0. 一句话结论

博客已可完整使用：公开站点（主页/学习记录/文章/项目/关于/404/SEO）+ 手机写作后台（登录、Tiptap 富文本、图片上传、自动保存、预览、发布/撤回、回收站恢复、二次确认单条永久删除、项目管理）。已通过真实浏览器（桌面 + 390px 手机）走通「登录 → 写作 → 传图 → 发布 → 公开页显示无误」全流程，并保留一篇真实文章《站点手记：纸上生长》。

## 1. 验证基线（最近一次全量，全部 PASS）

- `npm run test`：16 文件 / 94 测试通过
- `npm run lint`：0 错误 0 警告
- `npm run typecheck`：通过
- `npm run build`：通过，18 条路由（公开 + 后台全动态）
- `npm run audit --audit-level=high --registry=https://registry.npmjs.org`：0 漏洞
- `npx playwright test`：24/24 通过（空状态、后台全流程、用户目标流程、公开页，桌面 + 手机）
- 生产模式：`next build && next start` 后 `/articles`、文章详情（中文 slug）、`/rss.xml` 均 200
- 隐私扫描：公开页面无真实姓名/学校/联系方式/密钥（命中均为 UUID 片段与普通词）

## 2. 如何运行

```powershell
npm run dev          # http://localhost:3000
```

后台登录：`/admin/login`。未配置 `ADMIN_PASSWORD` 时使用开发默认密码 `lnstinct-dev`（登录页会提示）；正式使用请写入 `.env.local`。

## 3. 架构速览

```
app/
  page.tsx, articles/, essays/, projects/, about/, not-found.tsx
  robots.ts, sitemap.ts, rss.xml/route.ts
  admin/login/page.tsx                 # 登录（受保护布局之外）
  admin/(dashboard)/…                  # 概览/内容/项目管理（路由组布局统一 requireAdmin）
src/
  config/site.ts                       # 仅“小泽 / lnstinct.” + url（NEXT_PUBLIC_SITE_URL，默认 localhost:3000）
  domain/                              # Task 1 领域契约（含 image 富文本白名单）
  lib/store/files.ts                   # data/*.json 原子读写（无缓存）
  lib/content/                         # repository/file-repository/data-source/supabase-repository/filter/types
  lib/auth/                            # session.ts（HMAC 签名 cookie）+ server.ts（requireAdmin）
  lib/media/validate.ts                # 图片校验（纯函数）
  lib/actions/                         # 登录/内容/项目/媒体 Server Actions
supabase/migrations/0001_init.sql      # posts/projects/admin_users + RLS + Storage 策略（静态审查，未远程执行）
data/  public/media/                   # 用户数据（已 gitignore）
e2e/                                  # Playwright（系统 Edge；globalSetup 每轮重置 data/）
```

## 4. 已知限制（诚实标注）

- **Supabase 未远程验证**：无凭据，`0001_init.sql` 与 `supabase-repository.ts` 仅静态实现；配置公开变量后自动切换。
- **中文 slug 兼容**：Next 16.3 Turbopack dev 对非 ASCII 动态段传未解码值，详情页已做安全解码（生产 `next start` 已验证中文 slug 正常）。
- **后台认证**为本地密码会话（HMAC 签名 cookie），不依赖 Supabase Auth；无公开注册。
- **首发文章**：为完成“尝试上传文章并显示无误”的验收，站点保留一篇真实、诚实的第一篇文章（站点手记），内容无虚构成果；学习记录为空。如需恢复“零内容”首发状态，可在后台删除该文章（单条、二次确认）。

## 5. 未做（按计划禁止 / 等待用户确认）

- 公开 GitHub 仓库、Vercel 部署、Supabase 正式环境配置：**本地验收确认前不执行**。
- `git init`：原 `.git` 因沙箱属主问题备份于 `git-metadata-sandbox-backup`；重新初始化需用户授权并说明属主影响。

## 6. 文档

- README：`README.md`
- 计划：`docs/superpowers/plans/2026-08-27-lnstinct-blog.md`
- SDD ledger：`.superpowers/sdd/2026-08-27-lnstinct-blog/progress.md`
- Task 报告：`task-2-report.md`（公开站点）、`task-3-report.md`（数据层）、本文件（验收）
- 验收截图：`test-results/final-*.png`
