# lnstinct-blog 交接文档（公网部署完成）

> 更新时间：2026-08-28 19:29（Asia/Shanghai）
> 项目根目录：`E:\我的个人博客`
> 状态：**本地全功能博客已验收并成功部署到公网**；公开地址 `https://lnstinct-blog.vercel.app/`，仓库 `https://github.com/zeenhuang9-boop/lnstinct-blog`。

## 0. 一句话结论

博客已可完整使用：公开站点（主页/学习记录/文章/项目/关于/404/SEO）+ 手机写作后台（登录、Tiptap 富文本与 Markdown 双模式、图片上传、自动保存、预览、发布/撤回、回收站恢复、二次确认单条永久删除、项目管理）。2026-08-28 已修复北京时间跨日显示、发布时间精确到秒、文章改为学习记录未落库、后台“散文”残留，并移除首页“学习记录/了解更多”按钮。待本轮推送后重新核验公网。

## 1. 验证基线（最近一次全量，全部 PASS）

- `npm run test`：21 文件 / 110 测试通过
- `npm run lint`：0 错误 0 警告
- `npm run typecheck`：通过
- `npm run build`：通过，18 条路由（公开 + 后台全动态）
- `npm audit --audit-level=high --registry=https://registry.npmjs.org`：0 漏洞
- `npx playwright test`：28/28 通过，退出码 0（空状态、后台全流程、类型切换、公开页，桌面 + 手机）；使用独立测试服务器避免 Windows 子进程清理等待
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
  lib/content/                         # repository/file-repository/data-source/supabase-repository/filter/types/labels
  lib/date-time.ts                     # 固定 Asia/Shanghai，显示到秒
  lib/auth/                            # session.ts（HMAC 签名 cookie）+ server.ts（requireAdmin）
  lib/media/validate.ts                # 图片校验（纯函数）
  lib/actions/                         # 登录/内容/项目/媒体 Server Actions
supabase/migrations/0001_init.sql      # posts/projects/admin_users + RLS + Storage 策略（静态审查，未远程执行）
data/  public/media/                   # 用户数据（已 gitignore）
e2e/                                  # Playwright（系统 Edge；globalSetup 每轮重置 data/）
```

## 4. 已知限制（诚实标注）

- **Supabase 已由用户配置**，但本轮不读取或输出密钥；修复已同时覆盖文件仓储与 Supabase 管理仓储，生产写入闭环仍需部署后由用户登录验证。
- **Markdown 扩展仍为 Beta**：采用 Tiptap 官方 `@tiptap/markdown` 3.30.5，正文依旧保存为结构化 JSON，无数据库迁移。
- **中文 slug 兼容**：Next 16.3 Turbopack dev 对非 ASCII 动态段传未解码值，详情页已做安全解码（生产 `next start` 已验证中文 slug 正常）。
- **后台认证**为本地密码会话（HMAC 签名 cookie），不依赖 Supabase Auth；无公开注册。
- **首发文章**：为完成“尝试上传文章并显示无误”的验收，站点保留一篇真实、诚实的第一篇文章（站点手记），内容无虚构成果；学习记录为空。如需恢复“零内容”首发状态，可在后台删除该文章（单条、二次确认）。

## 5. 部署后待核验

- GitHub 公开仓库与 Vercel 部署均已完成，当前 `main`/`origin/main` 位于提交 `60870e6`。
- 本轮只读公网检查未修改生产内容；Supabase 正式环境的「登录 → 发布 → 刷新/重新部署后仍持久存在」闭环仍需用户授权后执行，不能只凭页面 200 推断数据库写入可靠。
- 原沙箱 `.git` 备份仍位于 `git-metadata-sandbox-backup`；当前仓库已经重新初始化，继续禁止恢复、递归移动或批量删除该备份。

## 6. 文档

- README：`README.md`
- 计划：`docs/superpowers/plans/2026-08-27-lnstinct-blog.md`
- SDD ledger：`.superpowers/sdd/2026-08-27-lnstinct-blog/progress.md`
- Task 报告：`task-2-report.md`（公开站点）、`task-3-report.md`（数据层）、本文件（验收）
- 验收截图：`test-results/final-*.png`
- 本轮修复计划：`docs/updates/2026-08-28-markdown-and-bugfixes.md`
