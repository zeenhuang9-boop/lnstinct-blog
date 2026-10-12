# 「她」页面 · 独立验证报告

> 验证者：verify（独立验证者，未参与实现）
> 时间：2026-10-12 10:18–10:45（Asia/Shanghai）
> 任务：task-3（本报告主体）／task-7（后台闭环，待 task-6 完成后追加）
> 写入范围声明：本报告只读实现代码，**未改动** `src/`、`app/`、`tests/`、`package.json`。
> 我新建的文件：`e2e/her-helpers.ts`、`e2e/her-routes.spec.ts`、`e2e/her-flows.spec.ts`、本报告、`.verification/*.mjs`。

---

## 1. 基线（改动前实测）

### 1.1 `npm run test` 基线

```
 RUN  v4.1.11 E:/我的个人博客

 ✓ tests/media-validate.test.ts (5 tests) 5ms
 ✓ tests/site-config.test.ts (2 tests) 3ms
 ...（共 21 个文件）
 ✓ tests/rich-text-editor.test.tsx (3 tests) 490ms

 Test Files  21 passed (21)
      Tests  111 passed (111)
   Start at  10:18:46
   Duration  23.36s (transform 3.41s, setup 74.86s, import 13.23s, tests 1.79s, environment 316.45s)
```

与 `AGENTS.md` 记录的「21 文件 / 111 测试」一致。

### 1.2 `npx playwright test` 基线

```
  30 passed (40.7s)
```

跑完后 3000 端口已释放，无残留 next 进程。Edge channel 正常，未下载浏览器。

### 1.3 三条环境坑（供后续复现者参考）

1. **PowerShell 会拦 `npm`**：`npm.ps1` 被 ExecutionPolicy 禁止运行，报
   `无法加载文件 C:\Program Files\nodejs\npm.ps1，因为在此系统上禁止运行脚本`（PSSecurityException）。
   解法：用 `npm.cmd` / `npx.cmd`。
2. **`2>&1 | Tee-Object` 会把 npm 的 stderr notice 提升成 `NativeCommandError`**，
   导致明明全绿的 vitest 看起来 `exit code 1`（错误文本是 `npm notice New major version...`）。
   实测：不带 `Tee-Object` 时 `npm run test` 的 `$LASTEXITCODE` 为 **0**。
   判断测试是否真的失败，要看 vitest 自己的 `Test Files / Tests` 摘要，不要只看 shell 退出码。
3. **绝不要用 PowerShell 往返读写含中文的源码**（我自己踩了，见 §4.2 缺陷 6）：不要
   `Get-Content -Raw | Set-Content`，也不要 `>` / `Out-File`。改用编辑工具（read/edit/write）。

---

## 2. 新建文件清单

| 文件 | 作用 |
|---|---|
| `e2e/her-helpers.ts` | 时区取「今天」、console/pageerror 采集、favicon 请求挡板、锚点 id 换算。**不含选择器** |
| `e2e/her-routes.spec.ts` | 三页路由与骨架：200、noindex、共用子导航 + `aria-current`、三页闭环、不进导航/sitemap、免登录 |
| `e2e/her-flows.spec.ts` | 倒计时一致性、跨页互链、照片真实解码、原位放大（Esc/关闭/滚动锁/焦点回位）、空状态 |
| `e2e/her-admin.spec.ts` | 后台闭环（改字段→保存→公开页断言→改回）、数据源容错（坏 JSON 3 形态 / 缺文件）、照片上传闭环 |
| `docs/her-verify-report.md` | 本报告 |
| `.verification/birthday-oracle.mjs` | 独立预言机（按 roadmap §3.3 文字语义手推，不引用 `src/`） |
| `.verification/date-differential.mjs` | 预言机 vs 实现的差分测试（8400 例） |
| `.verification/audit-test-expectations.mjs` | 逐条审计 `tests/her-birthday.test.ts` 里所有写死的期望值 |
| `.verification/shots/*.png` | 三页整页截图 + 局部放大图（视觉比对证据） |

---

## 3. 全量验证（逐项真实结果）

| 项目 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 单元测试 | `npm run test` | **PASS** — `23 passed (23)` / `183 passed (183)`，exit 0 | 基线 111 → 183（新增 her-birthday 31 + her-content 38 + her-store） |
| 类型检查 | `npm run typecheck` | **PASS** — exit 0，无输出 | 修掉我自己引入的 TS2345 之后 |
| 构建 | `npm run build` | **PASS** — exit 0 | 见 §3.1 |
| 代码规范（全仓） | `npm run lint` | **PASS** — exit 0，零输出 | Lead 处置掉 `scripts/_probe*.cjs` 与 `public/mockups/check-mockups.cjs` 之后，原先的 7 errors / 2 warnings 已消失；**「全仓 lint 绿」现在成立**（详见 §4.3 缺陷 5 的更新） |
| 代码规范（她相关文件） | `npx eslint e2e/her-*.ts src/components/her src/content/her.ts src/lib/date app/her tests/her-*.test.ts` | **PASS** — exit 0，零输出 | |
| 端到端（her 相关） | `npx playwright test e2e/her-routes.spec.ts e2e/her-flows.spec.ts e2e/her-admin.spec.ts --project=desktop` | **PASS** — 27 + 8 条，0 skipped | 闭环/容错/上传见 §3.8 |

### 3.1 `npm run build` 路由表（节选，真实输出）

```
├ ƒ /her
├ ƒ /her/letter
├ ƒ /her/photos
├ ƒ /admin/her        ← task-5 的后台编辑页
```

三条公开路由均为 **ƒ（Dynamic，server-rendered on demand）而非 ○（Static）**，
满足 `docs/her-page-roadmap.md` §5「构建」一行「`/her` 出现在路由表中为 ƒ 不是 ○」的验收标准。
（`export const dynamic = 'force-dynamic'` 生效，倒计时不会冻结在构建那天。）

### 3.2 跨页互链：实测证据

task-3 要求「真的点一遍，不是只测链接存在」。实测做了这些：

- `/her` 时间线缩略图 `href` **精确等于** `/her/photos#photo-2026-10-12-01-jpg`（用 `toBe` 全等，不是包含）；
- `click()` 之后断言 URL 正则 `/her/photos#photo-2026-10-12-01-jpg$`；
- 断言目标元素 `#photo-2026-10-12-01-jpg` 可见**且 `toBeInViewport()`**（锚点真的落地并滚动到位）；
- 断言目标元素内的 `<img src>` 等于 `/media/her/2026-10-12-01.jpg`（不是框住一块空白）；
- 照片墙组标题 `a[href="/her#page-built"]` 点击后 URL 为 `/her#page-built`，且 `#page-built` 在视口内；
- `/her` 的「照片墙 →」「信 →」两个入口分别真实点击，落到 `/her/photos`、`/her/letter`。

### 3.3 照片真实加载：证明「不是挂了个坏 URL」

- `request.get('/media/her/2026-10-12-01.jpg')` → 断言 `status === 200` 且 `content-type` 匹配 `^image/`；
- 照片墙图片：先 `scrollIntoViewIfNeeded()`（图片是 `loading="lazy"`，不滚动可能还没开始加载），
  再用 `expect.poll` 轮询 `naturalWidth` 直到 `> 0`；
- 时间线缩略图同样做 `naturalWidth > 0` 断言。

顺带用**结构校验**独立确认占位图是真 JPEG：`SOI=ff d8`、`EOI=ff d9`、SOF0 段尺寸 1200×900
（与 Lead 的 PIL 读数一致；我第一次报的「176×132」是我自己的解析器偏移写错了，见 §4.2 缺陷 7）。

### 3.4 倒计时一致性：未写死 364

期望值来自**页面同款来源**：

```ts
import { describeBirthday, daysTogether } from '../src/lib/date/birthday';
const today = todayInTimeZone();                       // Asia/Shanghai 取「今天」
const expected = describeBirthday(today, profile.birthday);
```

- 非生日当天：断言卡片数值 **全等** `String(expected.daysUntil)`；
- 生日当天：断言显示状态词「今天」而不是 `0`；
- 第二张卡（纪念日）**三件都断言**：主值 = `daysTogether(today, pageBuiltOn)` 的真实数字（不写死 0）、
  脚注必须有「在一起纪念日 · 待填」、且**不得**出现把数字标成「已走过的日子」的卡；
- 对称用例：把 `since` 临时设为 `2025-12-13` → 断言切成「已走过的日子」且数字 =
  `daysTogether(today, '2025-12-13')`，脚注消失；断言完在 `finally` 里**按原始字节写回**并在结尾复核还原生效。
- 时区处理：`todayInTimeZone()` 用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' })`
  取 `YYYY-MM-DD`，**不用** `new Date()` 的本地字段——否则在 UTC 环境跑、且上海时间处于 00:00–08:00 时
  会与页面差一天，造成假红。

### 3.5 日期层：独立预言机 + 8400 例差分

我按 roadmap §3.3 的文字语义**独立手推**了一份预言机（`.verification/birthday-oracle.mjs`，
不 import `src/` 任何东西），然后与实现做差分：

```
差分比对：8400 例（1200 天 × 7 组生日）
不一致：0 例
parseIsoDate 非法输入被误接受：0 []
daysTogether 同日 → 0
daysTogether 跨年 → 82
daysTogether null → null
daysTogether 未来 → -81
occurrenceOf 2027 / 2-29 → { year: 2027, month: 2, day: 28 }
occurrenceOf 2028 / 2-29 → { year: 2028, month: 2, day: 29 }
```

交叉印证：预言机在「今天 2026-10-12 + 生日 10-11」下算出 **364**，
与 `public/mockups/her-main-desktop.svg` 上画的 `364` 一致 —— 样式图与算法同源，不是拍脑袋的数。

### 3.6 隐私扫描（`app/`、`src/`、`public/`）

| 检查项 | 结果 |
|---|---|
| 手机号 `1[3-9]\d{9}` | 无命中 |
| 邮箱 | 无命中 |
| QQ 号（5–11 位） | 无命中 |
| 身份证（18 位） | 无命中 |
| 学校/机构名（大学/学院/中学/附中/职业技术学院…） | 无命中 |
| 三页 `robots` | 三页均为 `<meta name="robots" content="noindex, nofollow"/>`（实测 HTTP 响应体） |
| `/her` 是否进 sitemap | **否** —— sitemap 只列 `/`、`/learning`、`/articles`、`/projects`、`/about` 及文章页 |
| `/her` 是否进主导航 | **否** —— 实测 `header a[href]` 中无任何 `/her*`（子导航不在 header 内） |
| 公开昵称 | 只有「小宇」（昵称）与「小泽」（公开身份），符合 `AGENTS.md` §2 约束 |
| 照片 | `public/media/her/2026-10-12-01.jpg` 为暖纸底占位图，图上文字「照片占位图 · 换成你自己的照片即可」，**无人像、非下载素材** |

### 3.7 响应式与视觉比对（补掉了原先的「未验证」项）

| 视口 | 结果 |
|---|---|
| 390px（手机） | `/her`、`/her/photos`、`/her/letter` 三页 `scrollWidth === clientWidth === 390`，**无横向滚动** |
| 1280px（桌面） | 三页 `scrollWidth === clientWidth === 1280`，**无横向滚动** |
| 视觉 | 三页整页截图（`.verification/shots/`）与 `public/mockups/her-*-desktop.svg` 逐区核对：Hero、数字卡、大事记（锈红点 / 灰点 + 「待补」虚线）、最近的照片、两个入口、页脚说明，**结构、顺序、配色全部一致** |

---

### 3.8 后台闭环（task-7）：真实跑通，8/8 通过、0 跳过

`e2e/her-admin.spec.ts` 串行执行，实测尾部：

```
Running 8 tests using 1 worker

  ok 1 … 改「称呼」：公开页 h1 从原值变为新值，再改回原值 (2.8s)
  ok 2 … 改「副标题」：公开页从原值变为新值，再改回 (2.7s)
  ok 3 … 改「大事记」事件名：照片墙组标题与 /her 时间线同步变化 (3.6s)
  ok 4 … 给「信」加一段正文：/her/letter 从空状态变为显示该段；随后删除还原 (3.3s)
  ok 5 … 保存后公开页无 console 报错 (2.8s)
  ok 6 … data/her.json 是坏 JSON 时，三页仍 200 且回退到默认内容 (1.6s)
  ok 7 … data/her.json 不存在时三页仍 200 且回退默认内容 (607ms)
  ok 8 … 上传一张图并归到事件，保存后照片墙显示它；随后移除 (3.1s)

  8 passed (21.6s)
```

按 Lead 的要求，断言的是**「改动前 vs 改动后」的差异**，不是「页面有新值」——否则一个恒返回种子的页面也能过。
每条闭环用例都是四段式：**记原值 → 断言公开页当前 ≠ 新值 → 后台改并保存 → 断言公开页变成新值且不再是原值
→ 改回原值 → 断言公开页回到原值**，并额外校验 `data/her.json` 的落盘值（不只信渲染）。

| 用例 | 验证的链路 |
|---|---|
| 改「称呼」 | `/admin/her` → 保存 → `/her` h1 由原值变新值 → 改回；落盘值同步校验 |
| 改「副标题」 | 同上，第二处可观测字段 |
| 改「大事记」事件名 | `/her` 时间线**与** `/her/photos` 组标题同步变化（两页同源派生的实证） |
| 给「信」加一段 | `/her/letter` 从「这封信还没写完」→ 显示该段 → 删除后回到空状态 |
| 坏 JSON 容错 | 3 种形态（非法 JSON / 合法但校验不过 month=13 / 空文件）→ 三页均 **200** 且回退默认「小宇」 |
| 缺文件容错 | 删掉 `data/her.json` → 三页均 **200** 且回退默认内容 |
| 照片上传闭环 | 真实上传 `tests/fixtures/sample.png` → 归到事件 → 保存 → `/her/photos` 出现该锚点且 `naturalWidth > 0` → 删除还原（数量 +1 / 还原校验） |
| 公开页 console | 保存后公开页无 console/pageerror |

**数据隔离**：由 `e2e/global-setup.ts`（备份真实内容 → 写种子）+ `e2e/global-teardown.ts`（原样还原）负责，
本 spec 不做自己的备份还原。实测每轮尾部都打印
`[global-teardown] 已删除测试写入的 data/her.json（测试前不存在）`，跑完 `data/` 无 `her.json`、无备份残留。

---

### 3.9 最终全量（写入方全部停手 + 进程级锁落地后重跑）：96 passed / 0 failed / 0 skipped

Lead 加好 E2E 进程级锁（`data/.her-seed.lock`，`wx` 独占创建 + `process.kill(pid,0)` 存活探测接管残留锁）
并确认所有写入方停手后，我重跑全量：

```
npm.cmd run test       →  Test Files  24 passed (24) / Tests  214 passed (214)     TEST_EXIT=0
npm.cmd run lint       →  (无输出)                                                LINT_EXIT=0
npm.cmd run typecheck  →  (无输出)                                                TYPECHECK_EXIT=0
npm.cmd run build      →  BUILD_EXIT=0（含 ƒ /her、ƒ /her/photos、ƒ /her/letter、ƒ /admin/her）
npx.cmd playwright test →  96 passed (1.7m)
```

**三个数字：passed = 96，failed = 0，skipped = 0。** skipped 逐条说明：**没有 skipped**——
全文不含 `skipped` / `failed` / `did not run` / `flaky`（逐个关键词搜索确认），汇总只有一行 `96 passed`。

构成（共 96）：

| spec | 条数 | 说明 |
|---|---|---|
| `her-routes.spec.ts` | 8 | 三路由 200、noindex、子导航 + `aria-current`、免登录、不进导航/sitemap |
| `her-flows.spec.ts` | 20 | 倒计时一致、跨页互链、照片真解码、查看器、空状态、未归属尾组、对称用例 |
| `her-admin.spec.ts` | 11 | 后台闭环 4 + 容错 2 + hydration/字段 id 回归 2 + 上传 2（含多照片归属）+ console 1 |
| `her-audit.spec.ts` | 27 | Lead 保留的对抗性回归套件（多照片多事件归属漂移、并发保存、边界文案等） |
| 既有（aa-empty-state 1 / admin 19 / blog-flow 7 / zz-public 14） | 41 | 本次未改动，作为回归基线 |

**锁与还原实测**：这一轮 teardown 打印 `[global-teardown] 已还原测试前的 data/her.json`
（测试前**确实存在**真实内容，走的是「还原」分支）。跑完 `data/` 只剩
`.global-setup-ran`、`her.json`、`posts.json`、`projects.json`，**锁 / 备份 / state 三个临时文件全部清理**；
小泽的真实内容（986 B、称呼 小宇、纪念日 2025-12-13、1 条事件、1 张照片）在整轮测试后**逐字节完好**。

**两处由 Lead 修正我测试写法的地方**（我复核后认可并保留）：
1. 字段 id 的断言规则已更新：字段 id 现在是**纯渲染下标**（`her-event-title-0`），不再含事件 id
   （事件 id 可能含中文，不是合法 HTML id）。断言与注释按此改。
2. 多照片那条此前失败**不是产品缺陷，是测试写法**：`getByText(/已就位：/).last()` 会把**上一行**的
   「已就位」误当成新行上传成功，于是在上一张还在上传时就去点保存，那张被当空行丢掉。
   已改为对 `p` 元素做**计数**断言，并在点「+ 加一张」后等文件输入框数量 +1 再取 `.last()`。
   这条与 §4.2 里我自己的几处属同一类错误——**假失败往往先出在测试写法上**。

---

## 4. 缺陷清单

### 4.1 本任务期间发现并已由实现者修复的

**缺陷 1（已修）· `tests/her-birthday.test.ts:48-54` 期望值写错 → 全量测试变红**
- 现象：`npx vitest run tests/her-birthday.test.ts` → `Test Files 1 failed (1)` / `Tests 1 failed | 30 passed (31)`，exit 1。
- 原始报错：
  ```
  FAIL tests/her-birthday.test.ts > describeBirthday > 月首前一天：还差 1 天
  -   "daysUntil": 1,
  +   "daysUntil": 225,
   ❯ tests/her-birthday.test.ts:49:62
  ```
- 最小复现：`describeBirthday({year:2026,month:2,day:28}, {month:10,day:11})` → 实际 `225`，测试期望 `1`。
- 判定：**测试写错，实现正确**。三路核对：算术 3月31+4月30+5月31+6月30+7月31+8月31+9月30+10月11 = 225；
  我的独立预言机 = 225；`describeBirthday` = 225。用例名想测「前一天」但输入了 2-28（真正的前一天是 10-10）。
- 严重程度：**中**（不阻塞实现正确性，但会让全量验证失败）。
- 处置：已报告给 data-logic 与 lead；data-logic 拆成三条用例修正。我另用
  `.verification/audit-test-expectations.mjs` 逐条审计了该文件**全部** 14 条 `describeBirthday` + 4 条 `daysTogether`
  断言，确认**只有这一处**错，其余全对。

**缺陷 2（已修）· `e2e/her-flows.spec.ts` 类型错误（我自己的文件）**
- 现象：`npm run typecheck` → `error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`
- 根因：`event.photos` 在 `as const` 收窄后是联合类型，`[0]` 自然是 `string | undefined`。
- 严重程度：**低**（只挡我自己的文件，但会连带挡住 `npm run build`，因为 include 是 `**/*.ts`）。
- 处置：**我自己改的**：加 `firstPhotoFile()` 收窄 + `firstOrThrow()`，未用非空断言。

**缺陷 6（已修）· 我自己造成的「19 条用例被静默 skip」，最危险的一条**
- 现象：全量 E2E 一度是 `31 passed / 19 skipped`，报告仍是绿的，但**her-flows 的 19 条核心断言一条都没执行**。
- 根因（我的实现错误，在测试代码里）：我写了「惰性读 `data/her.json` + 缓存」的逻辑：
  ```ts
  let cachedProfile: HerProfile | null | undefined;
  function seededProfileOrNull() {
    if (cachedProfile === undefined) {
      try { cachedProfile = JSON.parse(readFileSync(HER_DATA_FILE, 'utf8')); }
      catch { cachedProfile = null; }          // ← 收集阶段文件还不存在，null 被永久缓存
    }
    return cachedProfile;
  }
  ```
  spec 模块会在**测试收集阶段**被求值一次，而 `e2e/global-setup.ts` 更晚才写文件；那次读失败后
  `null` 被缓存，之后每个 worker、每个用例都直接命中 `null`，`beforeEach` 一律判定「没读到内容」→ 全部 skip。
- 最小复现：上面这段逻辑 + 一条 `beforeEach(() => test.skip(seededProfileOrNull() === null, '...'))`，
  在 globalSetup 写文件之前发生首次调用，即 100% 复现全部 skip。诊断脚本实测输出
  `[module-top] 模块顶层调用结果 = null`、`[test2] lazy() 返回 null 调用次数 = 3`。
- 严重程度：**高**（会让未执行的测试看起来「按规则跳过」，从而以假绿结案）。
- 处置：**我自己改的**，去掉缓存改为每次现读（文件很小；且对称用例会改写内容，缓存本来也会读到旧值）。
  修后实测 `27 passed (13.2s)`，**0 skipped**，含此前被跳过的对称用例。
- 教训：**必须数 skip 的条数**，以及「skip 的原因」是否真的是预期原因。这也是我不接受「全绿」只看颜色的理由。

**缺陷 10（已由 Lead 修复，并经我的回归用例证实）· `src/components/admin/her-form.tsx:77-83` 的模块级 id 计数器导致 SSR/hydration 不匹配**
- 位置：`src/components/admin/her-form.tsx:77-83`（`let keySeed = 0; function nextKey() { keySeed += 1; return \`draft-${keySeed}\`; }`），
  配合 118/129 行的 `key: nextKey()` 与 581-649 行用 `event.key` 拼 `htmlFor` / `id`。
- 现象：打开 `/admin/her`，控制台报
  ```
  A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
  This won't be patched up. This can happen if a SSR-ed Client Component used:
  %s%s https://react.dev/link/hydration-mismatch
  -  htmlFor="her-event-title-draft-45"
  -  id="her-event-title-draft-45"
  -  htmlFor="her-event-id-draft-45"
  …（同组还有 iso/date/note，以及 draft-46 那一组）
  ```
  服务端 SSR 出的是 `draft-4`/`draft-5` 一代，客户端 hydration 期望 `draft-44`/`draft-45`/`draft-46` 一代；
  两次跑分别看到不同编号，说明它随请求数持续漂移，**不是偶发**。
- 最小复现：`'use client'` 组件在服务端也会渲染一次，而模块级可变计数器每渲染一次自增、全局模块实例跨请求累积，
  于是 SSR 与客户端 hydration 拿到不同编号。
- 严重程度：**中**（不阻断功能，受影响的是 `htmlFor`/`id` 关联、且 React 明确说不回补；但这是真实 hydration 缺陷）。
- 建议修法：id 改为由数据派生的确定性值（如 `her-event-title-${event.id}` 或 `${event.id}-${index}`），
  或改用 React `useId()`。
- **Lead 的实际修法**（我复核过 `her-form.tsx`）：把「表单字段 id」与「React key」分开——
  `TimelineDraft` / `PhotoDraft` 各加必填 `fieldId`，由数据派生（事件 `fieldId: ${event.id}-${index}`、
  照片 `fieldId: photo-${index}`，新增条目按当前长度派生），16 处 `htmlFor`/`id` 由 `${key}` 改为 `${fieldId}`；
  `key` 仍只作 React key。这与我建议的「确定性派生」一致。
- **我的回归用例（已真跑通过）**：
  1. `打开 /admin/her 不出现 hydration 不匹配报错` —— 以登录态打开表单，采集 console/pageerror，
     断言不含 `hydrated but some attributes` / `hydration-mismatch` / `Hydration failed`，且无其它 console 报错；
  2. `事件/照片字段的 id 是确定性值，不含自增的 draft-N` —— 取 DOM 中全部 `her-event-title-*` / `her-photo-file-*`，
     断言 id **不含 `draft-\d+`**、形如 `her-event-title-<id>-<index>` / `her-photo-file-<前缀>-<index>`、互不重复，
     并额外断言页面上**每个 `label[for]` 都指向存在的元素**（hydration 不匹配正会让这层关联断掉）。
  实测两条均通过（`10 passed`）。
- 说明一条限制：我**没有**通过「临时还原旧代码」来证伪这条回归用例。判断依据是修复前的实测报错原文、
  现在 DOM 里 id 已是确定性值、以及 `label[for]` 全部有效——足以支持结论，但严格说这是「修复后全绿 + 修复前有确凿红证据」，不是「用例被证伪过」。
- 我在另一条用例上的范围处理：该错误发生在 `/admin/her`（不是公开页），所以我把
  「保存后公开页无 console 报错」的采集范围收紧为「保存动作之后 + 公开页」，并在代码注释里写明原因与缺陷编号——
  既不吞公开页的真报错，也不让后台的既有缺陷把公开页用例判红。公开页实测无 console 报错。

### 4.2 我自己犯的错（记录在案，避免下次重犯）

**缺陷 11 · 我的 E2E 里两处「看起来对但会误判」的写法（都已修）**
1. `await expect(page).toHaveURL(/\/her$/)` —— 这个正则**同时匹配 `/admin/her`**。
   后果：点保存后「跳转完成」在后台页就被判成立，紧接着读到的 h1 是后台的「「她」」，
   报错信息变成 `保存后 hero 应显示新称呼 / Received string: "「她」"`。
   修法：改为比对 `new URL(page.url()).pathname === '/her'`。
2. 失败探测写成 `page.locator('[role="alert"], p.text-rust').first()` —— 会命中公开页数字卡前面
   那根 6×34 的**空文本**锈红竖条，于是 `Promise.race` 立刻判为「保存失败」并抛出一个空提示的异常。
   修法：收紧为 `p[role="alert"]`（表单的失败原因只在这个元素里，且只在出错时才渲染）。

**缺陷 12 · 容错用例里在 finally 中「现读」被写坏的文件（已修）**
- 我原本在 `finally` 里用 `seededProfile()`（会读文件）来还原，但那时文件正处在被我写坏的状态（最后一轮是空文件），
  于是还原自己抛错：`没有读到内容文件 data\her.json`。
- 修法：进 `finally` 之前先把**原始字节**读进变量，`finally` 只做写回。同一文件里的「对称用例」也是同样写法。

**缺陷 7 · 我报告的「JPEG 176×132」是错的，文件没问题**
- 我写了个 PowerShell JPEG 段解析器，把 SOF 段的高度偏移写成 `i+4`（正确是 `i+5`，因为 `i+2`/`i+3` 是段长度），
  于是算出 176×132。Lead 用 PIL 读到的 1200×900 是对的。
- 处置：已当场更正并说明是我的解析器 bug。**教训：验证工具本身也要被试，不能拿它当权威。**

**缺陷 8 · 我用 PowerShell 往返读写把 `e2e/her-flows.spec.ts` 写成了乱码**
- 操作：`Get-Content -Raw`（本机按 GBK 读取 UTF-8 文件）→ 正则批量替换 → `Set-Content -Encoding UTF8` 写回。
- 结果：全文件中文变 `鍙栦簨浠舵寕鐨?` 类乱码，`npm run typecheck` 报约 150 条语法错误，
  并因 `tsconfig.json` 的 `include: **/*.ts` 连带挡住 `npm run build`。
- 处置：我用 `write` 工具按上下文**整文件重写**并自测（`tsc --noEmit` exit 0、`eslint` exit 0、中文完好）。
  pages-ui 与 lead 都据此报过警，方向正确；lead 复核结论「不是不可逆丢失」也对——重写即可。
- 严重程度：**高**（阻断全项目构建）。**这是我这次交付里最该记住的教训**：
  本仓库含大量中文源码，PowerShell 的文本往返有编码陷阱，批量改写只能用编辑工具。

### 4.3 现存缺陷（未修，按规矩只报告）

**缺陷 3（已由 Lead 根治）· 全站没有 favicon 资产，`/favicon.ico` 404**
- 原现象：控制台出现 `Failed to load resource: the server responded with a status of 404 (Not Found)`，
  `message.location().url` 实测为 `http://127.0.0.1:3000/favicon.ico`。
- **与「她」页面无关**：这是**全站既有**问题，`/` 上就能复现（全新 context 单一路径实测：`/` 报该 404；
  `/her`、`/her/photos`、`/her/letter` 当时不报，因为它时有时无，取决于缓存与请求时机）。
- 严重程度：原为**低**（不影响功能，但污染控制台、让「无 console 报错」类断言天生不稳定）。
- **现状：Lead 已加 `app/favicon.ico`，dev 与 prod 均返回 200，已根治。**
- 我原先的处理也说明一下（避免被误读为「加白名单吞错误」）：我**没有**把 404 文本加进字符串白名单，
  而是用 `page.route` 把**这一个** URL 挡掉（返回 204）。现在站点已修好，该挡板不再命中；
  我保留它只作为防御（并在 helper 注释里写明「真正修的是站点，不是过滤器」）。

**缺陷 4 · `src/components/her/her-photo-anchor.ts:5-6` 注释里的示例与代码不符**
- 代码：`photoAnchorId('2026-10-12-01.jpg')` → `photo-2026-10-12-01-jpg`（**点号全换成短横，含扩展名**）。
- 注释却写：`例：'2026-10-12-01.jpg' → 'photo-2026-10-12-01'`（少了 `-jpg`）。
- 依据：契约与 `e2e` 实测 URL 都是带 `-jpg` 的 `/her/photos#photo-2026-10-12-01-jpg`（`<li id>` 实测同值），
  所以**代码是对的、注释是错的**。
- 严重程度：**低**（纯文档，但会误导下一个改锚点规则的人）。

**缺陷 5（已由 Lead 处置，现已消失）· `npm run lint` 曾有 7 errors / 2 warnings（全部在本任务之前就存在）**
- 位置：`public/mockups/check-mockups.cjs`（2 errors）、`scripts/_probe.cjs`（1）、`scripts/_probe4.cjs`（2 errors + 1 warning）、`scripts/_probe5.cjs`（2 errors + 1 warning）。
- 规则：`@typescript-eslint/no-require-imports`（`.cjs` 用 `require()`）+ `no-unused-vars`。
- **不是我引入的**，证据：`scripts/_probe*.cjs` 创建于 **08-30**（本次任务之前）；
  `public/mockups/check-mockups.cjs` 创建于 **10-12 10:14:37**，早于我 10:18 开始验证；均未被 git 跟踪。
- 我实测：`npx eslint` 对**本次交付的全部 her 相关文件** exit 0、零输出。
- **更新**：Lead 已处置这些文件；我复跑 `npm run lint` 现在为 **exit 0、零输出**。
  因此报告结论相应更新为「全仓 lint 绿」，这条不再构成保留条件。

**缺陷 9 · `npx tsc --noEmit` 曾因 Next 生成类型的半成品状态报错（非源码问题，重跑即恢复）**
- 现象：`error TS2307: Cannot find module './routes.js'` at `.next/types/validator.ts(5,79)`。
- 根因：`.next/types/` 处于半生成状态——`validator.ts` 引 `./routes.js`，而目录里只有 `routes.d.ts`。
  最可能是 dev server 与 `next build` 并发写这个目录。
- 处置：重跑一次 `npm run build`（exit 0）后 `npx tsc --noEmit` 恢复 exit 0。**未删除任何文件。**

### 4.4 不算缺陷但值得记录的观察

- `src/content/her.ts:108` 的 `since: null` 是**刻意**的（注释写明：用户说 12 月 13 日但**年份未定**，
  所以不写假日期）。页面上第二张卡因此显示「站在这页上的时间」+ 脚注「在一起纪念日 · 待填」，
  这是**诚实**行为。Lead 后已确认年份，真实内容的 `since` 会变成 `2025-12-13`。
- `HerEvent.photos` 用数组 `readonly string[]`、时间线取 `photos[0]`；`photoAnchorId` 在
  服务端（时间线缩略图）与照片墙 `<li id>` 两处**同一份实现**，不存在两套写法。
- 照片墙分组标题/日期/图注均经 `photoGroups()` 同源派生；测试断言「每个时间线事件在照片墙上都有对应组
  且标题包含事件名」，未发现两套文案。

---

## 5. 无法验证的部分及原因

1. **`prefers-reduced-motion` 下的淡入行为**：由 `motion-reduce:transition-none` 实现，属纯 CSS。
   Playwright 需 `page.emulateMedia({ reducedMotion: 'reduce' })` 才能验，我**没有**写该用例
   （属样式细节）。**未验证**，但 roadmap 只要求「尊重」该偏好，未规定可观测行为。
2. **暗色主题下的视觉一致性**：未验证（需截图比对，本次只做了亮色）。
3. **「信」写满后的长篇排版**：当前种子与真实内容的 `letter.paragraphs` 都还是空数组，
   我只验了「空状态文案」与「加一段后显示该段」；**引用块 / 落款 / 多段间距的完整排版未验证**。
4. ~~后台闭环~~ —— **已验证**（§3.8，8 条闭环/容错/上传用例全绿，含 `data/her.json` 落盘值校验）。
5. ~~`npm run lint` 作为验收门槛~~ —— **已通过**（Lead 处置既有文件后，全仓 `lint` exit 0、零输出）。
6. **`npm run test` 里 her 之外的既有用例**：数量；我确认汇总 214 passed 且无回归变红，
   但未逐条复核那 145 条的断言内容（不在本次交付范围）。
7. **会话级 `npm run dev` 下的人工视觉走查**：未做（本次为自动化验证 + 截图比对）。

---

## 6. 一句话结论

**可以通过。** 「她」页面（三页 + 后台编辑闭环 + 内容可编辑）我独立验证下来没有发现功能性缺陷，
全量验证 `test / lint / typecheck / build` **四项全部 exit 0**，E2E **96 passed / 0 failed / 0 skipped**。

最终全量实测（写入方全部停手、进程级锁落地后跑的，原始尾部）：

```
npm.cmd run test       →  Test Files  24 passed (24) / Tests  214 passed (214)   TEST_EXIT=0
npm.cmd run lint       →  (无输出)                                              LINT_EXIT=0
npm.cmd run typecheck  →  (无输出)                                              TYPECHECK_EXIT=0
npm.cmd run build      →  BUILD_EXIT=0，路由表含 ƒ /her、ƒ /her/photos、ƒ /her/letter、ƒ /admin/her
npx.cmd playwright test →  96 passed (1.7m)
```

E2E 三个数字（Lead 要求）：**passed = 96，failed = 0，skipped = 0**。
逐条说明 skipped：**没有 skipped**（全文不含 `skipped` / `failed` / `did not run` / `flaky`）。
构成：`her-routes` 8 + `her-flows` 20 + `her-admin` 11 + `her-audit` 27 + 既有 41 = 96。
（基线为 30 条；我新增 39 条，Lead 保留的 audit 对抗套件 27 条。）

验证覆盖（全部真跑）：三路由 200 与 `noindex`、共用子导航 + `aria-current`、三页闭环互链、
时间线缩略图 → 照片墙锚点（精确 href + 点击 + 进视口 + 图真解码）、照片墙组标题 → 回时间线、
查看器 Esc/关闭按钮/滚动锁/焦点回位、空状态、**后台闭环 4 条四段式差异断言**、
**坏 JSON 3 形态 + 缺文件回退**、**照片上传闭环（含同一事件挂两张照片的归属不漂移）**、
**缺陷 10 hydration 回归**、**task-8 未归属尾组**、
390px 与 1280px 无横向滚动、视觉与样式图一致、隐私扫描无真名/学校/联系方式；
日期层另有 **8400 例独立差分零不一致**。

**数据安全（本报告最重要的一条结论）**：E2E 期间会写 `data/her.json`，而它是小泽的真实内容。
整轮验证跑完后我逐字核对：**内容逐字节完好**（986 B、称呼 小宇、纪念日 2025-12-13、1 条事件、1 张照片，
照片 `d7d00231-…jpg` 与事件的引用关系一致），锁 / 备份 / state 三个临时文件全部清理，
`public/media/` 里他引用的那张 1.3 MB 照片与内容引用的占位图都在。

必须写明的保留（都不在「她」页面的实现里）：
1. **未验证项**：暗色主题视觉、`prefers-reduced-motion` 淡入行为、信写满后的长篇排版、
   以及会话级 `npm run dev` 下的完整人工视觉走查。本报告不含这几项结论。
2. **未逐条复核**：`npm run test` 的 214 条里，我独立验证的是 her 相关的 69 条（her-birthday 31 +
   her-content 38，其中 her-content 我通读了断言）与日期层差分；其余既有用例我只看汇总结果与回归是否变红。
3. **缺陷 4**（`her-photo-anchor.ts` 注释示例与代码不符）与**缺陷 10 的文档化描述**属低影响项，未修；
   缺陷 10 的**行为**已由 Lead 修好并经我的回归用例证实。

我自己犯的三个错也一并交代，不藏：
- **缺陷 6**：我写的「惰性读 seed + 缓存」让 19 条核心用例被静默 skip，报告仍是绿的。是我发现并修掉的，
  教训是**必须数 skip 条数、核对 skip 原因**，不能只看颜色。
- **缺陷 8**：我用 PowerShell 往返读写把 `e2e/her-flows.spec.ts` 写成乱码，连带挡住全项目 build。
  已用 `write` 整文件重写并自测通过。
- **缺陷 11 / 12**：我自己 E2E 里的两处误判写法（`/\/her$/` 也匹配 `/admin/her`；失败探测命中空文本的装饰元素）
  与一处「在 finally 里现读被写坏的文件」，均已修正。
- 另更正我先前报错的「JPEG 176×132」（我的解析器偏移写错，文件本身 1200×900 没问题）。
