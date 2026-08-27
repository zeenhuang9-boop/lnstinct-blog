# lnstinct. · 小泽的个人博客

「纸上生长」设计语言的个人博客：暖纸底色、墨色正文、锈红点缀，支持亮暗主题与手机阅读。
公开身份仅使用「小泽 / lnstinct.」。

## 功能

- **公开站点**：主页、学习记录、文章、项目、关于、404；文章与学习记录列表**按发布时间倒序**展示（无搜索、无标签筛选）；RSS、sitemap、robots。
- **手机写作后台**：登录 → 写作（标题、摘要、正文、图片上传，内容类型：文章 / 学习记录）→ 自动保存 → 预览 → 发布/撤回 → 回收站恢复 → 单条永久删除（二次确认）。
- **本地优先存储**：未配置 Supabase 时使用 `data/` 下的 JSON 文件存储，发布后公开页面立即可见；配置了 Supabase 公开变量时自动切换云端读取。

## 环境变量

复制 `.env.example` 为 `.env.local` 并按需填写：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 站点公开 URL，默认 `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | 可选：配置后公开站数据走 Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 可选：Supabase 匿名只读 key |
| `ADMIN_PASSWORD` | 后台管理员密码（未配置时使用本地开发默认值 `lnstinct-dev`，登录页会提示） |
| `ADMIN_SESSION_SECRET` | 会话签名密钥（未配置时使用本地开发默认值） |

> 安全提示：`ADMIN_PASSWORD` 与 `ADMIN_SESSION_SECRET` 在正式使用前必须配置到 `.env.local`，
> 不要提交真实密钥；`.env*` 已被 `.gitignore` 忽略。

## 本地运行

```bash
npm install          # 首次安装（lockfile 已锁定精确版本）
npm run dev          # 开发模式 http://localhost:3000
```

后台入口：`http://localhost:3000/admin/login`。

## 数据库与迁移

默认使用本地 `data/posts.json` / `data/projects.json`（自动创建）。这两处与 `public/media/`（上传图片）已加入 `.gitignore`，属于用户数据。

如要切换 Supabase：

1. 在 Supabase 创建项目，把公开 URL 与 anon key 填入 `.env.local`。
2. 执行迁移 `supabase/migrations/0001_init.sql`（posts/projects/admin_users + RLS + Storage buckets）。
3. 在 `admin_users` 表中加入你的 `auth.uid()` 后即可使用后台写操作。
4. 后台登录仍使用本地的 `ADMIN_PASSWORD` 会话体系，不依赖 Supabase Auth 注册（无公开注册页）。

## 常用命令

```bash
npm run test        # 单元测试（Vitest + Testing Library）
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # 生产构建
npm run start       # 生产模式运行（先 build）
npx playwright test # E2E（使用系统 Edge，需先启动 dev 或由 webServer 自动启动）
```

## 备份与恢复

本地内容即 `data/` 目录（posts.json / projects.json）与 `public/media/`。
备份：直接复制这两个位置。恢复：放回原路径并重启服务即可。
Supabase 项目空闲过久会被暂停：在控制台唤醒后重新运行，无需改代码。

## 常见故障

- **后台无法登录**：确认 `.env.local` 中 `ADMIN_PASSWORD` 已配置；未配置时使用默认密码（登录页有提示）。
- **发布后公开页没有更新**：所有内容页均为动态渲染（force-dynamic），刷新即可；若使用生产构建，确保重启 `next start` 或数据文件在服务进程可见路径。
- **图片上传失败**：仅支持 JPEG/PNG/WebP/AVIF 且不超过 5 MiB。
- **端口占用**：`npm run dev` 默认 3000；被占用时用 `npm run dev -- -p 3001` 指定端口。

## 约束

- 不提供评论、公开注册、定时发布、多人协作与批量删除；永久删除一次只处理一条且需二次确认。
- 站点身份仅「小泽 / lnstinct.」，不出现真实姓名、学校、联系方式或家庭信息。
