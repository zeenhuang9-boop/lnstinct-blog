# Task 1 报告：工程基础与领域契约

## 修改文件

- `package.json`：固定 Next.js、React、TypeScript、Tailwind、Zod、Vitest、Testing Library、ESLint、Playwright、Supabase 与 Tiptap 的指定版本，采用 ESM，并提供开发、构建、静态检查、类型检查和单测命令。
- `tsconfig.json`、`vitest.config.ts`、`tests/setup.ts`、`eslint.config.mjs`、`postcss.config.mjs`、`playwright.config.ts`、`.env.example`、`.gitignore`、`next-env.d.ts`：工程与测试配置。
- `app/layout.tsx`、`app/page.tsx`、`app/globals.css`：最小 App Router 骨架；没有实现公共页面视觉。
- `src/lib/slug.ts`：标题 slug 规范化。
- `src/domain/types.ts`、`src/domain/content-status.ts`、`src/domain/tiptap-content.ts`、`src/domain/input-schemas.ts`：领域类型、状态机、富文本白名单和表单校验。
- `src/config/site.ts`：仅包含“小泽 / lnstinct.”的公开站点身份配置。
- `tests/slug.test.ts`、`tests/content-status.test.ts`、`tests/input-schemas.test.ts`、`tests/tiptap-content.test.ts`、`tests/site-config.test.ts`：领域行为测试。

## TDD 记录

1. 先新增全部领域行为测试，再新增对应生产代码。
2. RED 命令：`npm run test -- tests/slug.test.ts`。
   - 初次结果：依赖尚未安装时，Vitest 命令不可用；这是运行环境阻塞，非领域行为的有效 RED 输出。
3. GREEN 命令：`npm run test`。
   - 结果：通过，5 个测试文件、17 个测试全部通过。
4. 第 2 轮（输入 URL 与 Tiptap 结构约束）先新增 6 个行为测试，再更新生产代码。
   - RED 命令：`npm run test -- tests/input-schemas.test.ts tests/tiptap-content.test.ts`。
   - RED 结果：2 个文件失败，新增的 6 个测试失败；`javascript:`、`data:`、`ftp:` URL 仍被接受，嵌套 `doc` 和容器节点 `marks` 仍被接受。
   - 首次 GREEN 尝试：新增协议限定后，已有的 `not a url` 用例暴露 `new URL` 抛出的 `TypeError`。这是校验器在基础 URL 校验失败时仍执行 refine 的边界问题。
   - 最终 GREEN：协议判断改为不抛出的布尔校验后，同一目标命令通过（2 个文件、14 个测试）。
5. 第 3 轮（Tiptap 严格父子结构）先新增 16 个拒绝/允许行为测试，再更新生产代码。
   - RED 命令：`npm run test -- tests/tiptap-content.test.ts`。
   - RED 结果：1 个文件中 9 个结构违例被错误接受、13 个既有或允许用例通过。违例包括根文档直接含 text、列表直接含 paragraph、text 含 content、文本块直接含块节点，以及 listItem 直接含 text/listItem。
   - GREEN：同一目标命令通过（1 个文件、22 个测试）。
   - 验证中类型检查曾发现闭包未保留 `value.type` 的 string 窄化；改为固定局部 `nodeType` 后，未改变运行时行为，完整检查均通过。

## Ledger 裁定

- 初版测试创建时的 Vitest 进程输出未保留为可独立复核的领域级 RED 证据：当时唯一可确认的记录是依赖未安装导致命令不可用。该条只能作为环境阻塞历史，不能事后表述为已验证的行为 RED；第 2 轮保留了可复核的 RED/GREEN 输出。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npm run test` | 通过：5 个文件、39 个测试。 |
| `npm run lint` | 通过：无警告；PostCSS 匿名默认导出已改为具名配置对象。 |
| `npm run typecheck` | 通过（`tsc --noEmit`，2026-08-27）。 |
| `npm run build` | 通过（Next.js 16.3.2，2026-08-27）。 |

## 风险与阻塞

- 依赖现已安装且 `package-lock.json` 已存在。初始下载失败记录仅保留为 TDD 环境历史，不再阻塞构建或类型检查。
- `app/layout.tsx` 已改用相对样式导入 `./globals.css`，与仅映射 `src` 的 `@/*` 别名保持一致；`package.json` 已显式标为 ESM，消除 Vitest 的 ESM 警告且与现有 Next.js 配置兼容。
- 本轮 manifest 精确加入 `@supabase/supabase-js@2.112.4`、`@supabase/ssr@0.12.4` 与 6 个 `@tiptap/*@3.30.5` 依赖。官方元数据确认该统一版本为 MIT 许可、来源为 `ueberdosis/tiptap`；按职责约定未执行安装，也未修改锁文件，主代理安装时须更新并核验 `package-lock.json`。
- `.gitignore` 现忽略所有 `.env*` 文件但显式保留 `.env.example`，并忽略 TypeScript 增量构建信息文件。
- 实施计划未逐字段定义 `Post` 和 `Project`。当前采用了最小、可直接映射到后续仓储层的字段集：应用层使用 camelCase，`PostRow` / `ProjectRow` 保留同义 snake_case 数据库字段；后续迁移须沿用该约定或在更改前同步更新契约与测试。
- 富文本白名单声明为 doc、paragraph、text、heading（1–3）、bulletList、orderedList、listItem、blockquote、codeBlock、hardBreak，以及 bold、italic、strike、code、link 标记；链接只接受 http、https、mailto 协议。
- 富文本结构额外限制：doc/blockquote 仅含块节点；列表仅含 listItem；listItem 仅含 paragraph 或嵌套列表；paragraph、heading、codeBlock 仅含 text/hardBreak。image 仍不在白名单内，留待 Task 4 单独决策。
- 目录当前不是 Git 工作树，未创建提交。
