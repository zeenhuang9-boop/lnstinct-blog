# Task 1：工程基础与领域契约

项目根目录：`E:\我的个人博客`

先阅读：
- `docs/superpowers/plans/2026-08-27-lnstinct-blog.md`
- `.superpowers/sdd/2026-08-27-lnstinct-blog/progress.md`

## 交付目标

1. 使用当前官方稳定版建立 Next.js App Router + TypeScript + Tailwind 工程，npm 锁定依赖。
2. 配置 ESLint、Vitest、Testing Library、Playwright、typecheck 命令和 `.env.example`。
3. 严格 TDD：每个领域行为先写测试并记录 RED 输出，再实现 GREEN。
4. 实现并测试：
   - `slugifyTitle(input: string): string`：英文小写连字符；中文安全保留；空输入生成稳定的 `untitled`。
   - `transitionStatus(current, event)`：draft/published/trashed 的发布、撤回、移入回收站、恢复规则；非法转换返回明确错误。
   - Zod `postInputSchema`、`projectInputSchema`，拒绝空标题、非法 URL、过多标签和未知类型。
   - Tiptap JSON 白名单校验，仅允许 plan 中声明的正文节点与安全链接协议。
   - 强类型 `siteConfig`，公开身份只能是“小泽 / lnstinct.”，不含学校、真实姓名、联系方式或家庭信息。
5. 公共数据类型固定：
   - `PostKind = 'article' | 'essay'`
   - `ContentStatus = 'draft' | 'published' | 'trashed'`
   - `Post` 与 `Project` 字段与计划一致，数据库字段用 snake_case，应用层用 camelCase。
6. 添加中文注释解释关键设计原因，不写显而易见的逐行注释。

## 边界

- 不实现页面视觉、不接 Supabase、不实现后台。
- 不创建 C 盘项目文件。
- 不提交或编造真实内容。
- 不执行 push、发布或外部账号写入。
- 你不是唯一参与者，不得撤销别人的修改。

## 验证

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

将完整报告写入 `.superpowers/sdd/2026-08-27-lnstinct-blog/task-1-report.md`，包含：修改文件、RED/GREEN 命令与结果、验证结果、风险或阻塞。只提交 Task 1 范围的改动。

