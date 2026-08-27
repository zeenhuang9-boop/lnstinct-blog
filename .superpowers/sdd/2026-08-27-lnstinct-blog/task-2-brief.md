# Task 2：公开站点与“纸上生长”设计系统

先阅读 Task 1 领域接口、项目计划和 ledger；不得改变 Task 1 的公开类型契约。

## 交付目标

1. 严格 TDD：页面/组件行为先写失败测试并运行，再实现。
2. 实现路由：`/`、`/projects`、`/articles`、`/articles/[slug]`、`/essays`、`/essays/[slug]`、`/about`、404。
3. 首页包含：文字 Hero、公开履历摘要、精选项目、最新文章、最新散文；没有内容时显示诚实空状态。
4. 视觉：暖纸 `#f7f1e7`、墨色高对比正文、锈红强调；暗色为炭黑书页。使用系统中文衬线/无衬线字体栈，避免外部字体依赖。无渐变按钮、无玻璃拟态、无统一圆角卡片墙。
5. 全站布局：响应式 Header、移动导航、Footer、主题切换、跳到主内容链接、清晰 focus-visible。
6. 内容能力：标题/标签查询（URL `q` 和 `tag`）、文章阅读进度、代码块、原生分享或复制链接。
7. SEO：静态/动态 Metadata、canonical、Open Graph、`sitemap.ts`、`robots.ts`、`app/rss.xml/route.ts`。
8. 数据层暂用接口 `contentRepository`；无 Supabase 环境时返回空数组。测试可注入内存仓储，但生产不得放示例文章。
9. `siteConfig` 公开身份只用“小泽 / lnstinct.”；关于页只能写软件工程学生、数学建模、AI 协作、项目实践、数学建模协会负责人，不出现学校、真实姓名、联系方式或家庭信息。

## 验证

- 组件测试覆盖导航、主题、空状态、文章/散文隔离、搜索参数和分享回退。
- `npm run test && npm run lint && npm run typecheck && npm run build`
- 报告写入 `task-2-report.md`。

你不是唯一参与者，不得撤销其他修改；不得触碰 git-metadata-sandbox-backup；不得部署、push 或新增外部账号。

