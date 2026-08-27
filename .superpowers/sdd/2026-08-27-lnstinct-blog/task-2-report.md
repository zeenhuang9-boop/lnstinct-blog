# Task 2 报告：公开站点与「纸上生长」设计系统

日期：2026-08-27
状态：完成并验证

## 交付内容

- 路由：`/`、`/projects`、`/articles`、`/articles/[slug]`、`/essays`、`/essays/[slug]`、`/about`、404、`robots.ts`、`sitemap.ts`、`rss.xml`。
- 首页：文字 Hero、关于摘要、精选项目、最新文章、最新散文；无数据时显示诚实空状态。
- 视觉：暖纸 `#f7f1e7`、墨色正文、锈红强调；暗色炭黑书页（`html.dark` + localStorage + 内联脚本防闪烁）；系统中文衬线/无衬线字体栈；无渐变/玻璃拟态/统一圆角卡片墙。
- 全站布局：响应式 Header、移动导航（390px）、Footer、主题切换、跳到主内容、focus-visible。
- 内容能力：标题/标签查询（URL `q` 与 `tag`）、阅读进度、代码块、原生分享或复制链接回退。
- SEO：动态 Metadata、canonical、Open Graph、sitemap、robots、RSS。
- 数据层：`contentRepository` 接口 + 运行时数据源切换（Supabase 配置存在时走云端，否则本地文件存储）；无内容时诚实空状态。
- `siteConfig` 公开身份仅「小泽 / lnstinct.」，关于页只写软件工程学生、数学建模、AI 协作、项目实践、数学建模协会负责人。

## 修复的关键问题

- `tests/setup.ts` 显式注册 `afterEach(cleanup)`：未开启 vitest globals 时 Testing Library 自动清理失效导致测试间 DOM 累积。
- `site-header` 内部导航必须使用 `next/link`（lint `no-html-link-for-pages`）。
- `theme-toggle` 不能同步 setState in effect（lint `react-hooks/set-state-in-effect`）：重构为 `useSyncExternalStore` + 模块级缓存 + 自定义事件。
- `share-actions` 服务端与客户端 `navigator.share` 不一致导致水合失败：改为挂载后异步判定。
- Next 16.3 Turbopack 对非 ASCII 动态段传入未解码参数：详情页 `decodeSlugParam` 安全解码。
- 本地文件存储去掉进程内缓存：避免 Turbopack dev 多模块实例导致「写入后公开页读到旧数据」。

## 验证

- `npm run test`：16 个测试文件 / 94 个测试通过。
- `npm run lint` / `npm run typecheck` / `npm run build`：全部通过。
- 浏览器验收：真实 Edge 桌面 + 390px 手机视口走通导航、空状态、文章显示（见 Task 5 E2E）。
