# 「她」页面 · 独立对抗性审计报告

- 审计者：teammate `audit`（独立于实现者，只报告不代改）
- 时间：2026-10-12（Asia/Shanghai）
- 被测版本：工作树状态，`git HEAD = fffbbb3`（`main`；`app/her/**`、`src/components/her/**`、
  `src/components/admin/her-form.tsx` 等「她」相关文件均为 untracked 的未提交状态）
- 运行方式：`npm run dev` 已在 3000 端口运行（`reuseExistingServer: true` 复用），系统 Edge（`channel: 'msedge'`）
- 审计用例：`e2e/her-audit.spec.ts`（27 条，全部新增；自带夹具，不依赖别的 spec 留下的状态）
- 数据隔离：沿用 `e2e/global-setup.ts` / `global-teardown.ts` 的「接管 + 还原」；
  需要造非常规状态的用例在 `try/finally` 里把 `data/her.json` **原字节写回**
- 跑完复查 `data/`：只剩 `.global-setup-ran`、`her.json`（真实内容，SHA256 与审计前一致
  `942CACDC…041564`）、`posts.json`、`projects.json`；无 `.tmp` 残留、无 `.her-seed-backup.json`、
  无 `.her-seed-state.json`、无 `.her-seed.lock`
- `public/media/` 复查：**我的 spec 一张图都没上传**（我的 `writeFileSync` 只写 `data/her.json`；
  审计前的真实照片 `d7d00231-….jpg` 完好）。但目录里多了 2 个 675B 的 png
  （`37776c28-….png`、`0503bea8-….png`，11:53:40），来自**别人那条上传用例**
  `her-admin.spec.ts:515`（我为定位它的失败单跑过一次，合并运行也跑过一次）——
  它与既有上传用例 `:457` 的行为一致（两者都只清理 `data/her.json` 里的照片行，不删媒体文件，
  目录里本来就有 ~30 个同类遗留）。`public/` 不在我的写入范围，我**没有删除**这 2 个文件。

---

## 1. 新增文件清单

| 文件 | 说明 |
| --- | --- |
| `e2e/her-audit.spec.ts` | 27 条对抗性审计用例：A 组合与幂等（5）/ B 改锚点 id 连锁（2）/ C 空与极值（7）/ D 公开页健壮性（2）/ E 查看器边界（3）/ F 表单行身份（8） |
| `docs/her-audit-report.md` | 本报告 |

未改动 `src/`、`app/`、`public/`、`tests/`、其他人的 e2e 文件。

### 关于 `data/her.json` 的并发风险（Lead 已加锁修复）

审计开始时 `data/her.json` 装的是**用户真实内容**，而 `global-setup.ts` 会把「当时看到的 `her.json`」
复制到 `data/.her-seed-backup.json`。若两个 playwright 进程同时跑，后启动的那次会把**前一次写入的测试种子**
当成真实内容覆盖掉同一个备份文件，两次 teardown 都还原种子 → 真实内容永久丢失。
我把审计前的真实内容另存到 repo 外（`%TEMP%\dsh-her-audit-safety-her.json`）作为保险，
并在每轮跑完核对 `data/her.json` 的 SHA256 与审计前一致。
**Lead 已确认并给 `global-setup.ts` 加了 `data/.her-seed.lock` 独占锁（拿不到锁就大声失败）**。
本报告的所有运行输出里都没有出现锁相关日志。

---

## 2. 真实输出

```
> npx.cmd playwright test e2e/her-audit.spec.ts --reporter=list

[global-setup] reset data at E:\我的个人博客\data（她：已备份真实内容，测试后还原）

Running 27 tests using 1 worker
  ok  1  A1 一个事件 2 张 + 后补第 3 张：保存 → 重载 → 再保存，归属不漂移且第二次保存零漂移 (4.2s)
  ok  2  A2 一张照片在两个事件之间来回改归属：两跳都要求列表与 eventIso 同步 (2.6s)
  ok  3  A3 删除挂着照片的事件：照片不跟着消失、退回未归属，保存被明确拦下；改挂别的事件后能存 (1.5s)
[审计 A4] 一个 tick 内两次点击 → Server Action POST 次数 = 2；表单提示 = （无）
  ok  4  A4 同一个 tick 里点两次保存：内容不能被写坏，也不该冒出文件系统错误 (2.9s)
  x   5  A5 两个标签页同时保存：内容仍可解析，也不能出现文件系统错误 (28.4s)
  ok  6  B1 把 audit-e1 改成 audit-e1-renamed：/her 锚点、照片墙回链都跟新 id，且不留指旧 id 的死链 (2.8s)
  ok  7  B2 锚点 id 填了非法值（大写与空格）：整份拒绝保存，磁盘内容不动 (1.1s)
  ok  8  C1 删光所有事件只剩照片：照片出现在尾组，三页都正常 (1.9s)
  ok  9  C2 删光所有照片：时间线显示待补，照片墙空状态，主页「全部 N 张」入口消失 (1.9s)
  ok 10  C3 信里只填引用、不填正文：应渲染引用块，而不是「这封信还没写完」 (368ms)
  ok 11  C4 称呼首尾带空格：保存后被去掉，公开页不留可见空白 (1.6s)
  ok 12  C5 纪念日填未来日期：显示「距离在一起纪念日」与正数，不出现负数 (403ms)
  x  13  C6 生日填 2-29：卡片写的「下一次落在…」必须与倒计时真的落点一致 (5.4s)
  x  14  C7 建页日填未来日期（后台可直接存）：第二张卡不能显示负数 (1.8s)
  ok 15  D1 事件名/图注/正文里的 HTML 与脚本片段：原样显示为文本，不执行 (1.0s)
  x  16  D2 超长且不可断行的文本：390px 与 1280px 都不应产生横向滚动 (1.5s)
  ok 17  E1 只有 1 张照片：左右键不越界，始终停在 1 / 1 (557ms)
  ok 18  E2 多组之间切换：序号与内容同步，首尾循环不越界 (573ms)
  ok 19  E3 打开后连按 Tab / Shift+Tab：焦点始终锁在查看器里 (485ms)
  x  20  F1a 事件的 key 撞车：改一行的标题会同时改到另一行 (998ms)
  x  21  F1b 事件的字段 id 撞车：同一页出现两个相同的 DOM id (1.1s)
  x  22  F1c 事件的 key 撞车：删掉一行会连带删掉另一行 (6.1s)
  x  23  F2a 照片的 key 撞车：改一行的图注会同时改到另一行 (1.1s)
  x  24  F2b 照片的字段 id 撞车：同一页出现两个相同的 DOM id (1.0s)
  x  25  F2c 照片的 key 撞车：删掉一张会连带删掉另一张 (6.1s)
  x  26  F3a 照片行 key 与文件名撞车：删掉新增的空行会连带删掉真实照片行 (6.0s)
  x  27  F3b 同一撞车的后果：保存后真实照片从数据与公开页一起消失 (6.9s)

[global-teardown] 已还原测试前的 data/her.json

  12 failed
  15 passed (1.7m)
```

**passed = 15 / failed = 12 / skipped = 0**（共 27 条；退出码 1）。

红掉的 12 条全部是**有意的回归闸门**（断言的是「正确行为」，修好后应当变绿），不是我的用例写错。
12 条里有 8 条来自同一个根因（缺陷 1），其余 4 条是缺陷 2–5。

### 运行历史（说明哪些结论是稳定复现、哪些是时序竞争）

- 第一次完整运行（修掉我自己两处选择器错误之前）：`14 failed / 12 passed / 0 skipped`。
  其中 A1、B1 的红是**我的用例写错**（`a[href="/her/photos#photo-…"]` 同时命中时间线缩略图与
  「最近的照片」，Playwright strict mode 报两个元素），不是产品缺陷；已改成限定在 `ol` 内，之后稳定绿。
- `A5`（两个标签页同时保存）**4 次执行里 2 次红**：11:44（耗时 27.7s，标签页 A 报 ENOENT）、
  11:55（耗时 28.4s，标签页 B 报 ENOENT）；另两次 3.4s / 3.5s 通过。
  两个失败都是同一形态：`ENOENT: no such file or directory, rename '…\data\her.json.tmp' -> '…\data\her.json'`。
  这是**时序竞争**，不是稳定复现，报告里按 2/4 如实记录。
- `F1a` 的原始证据（种子 3 条事件那一版）：
  `改一行只应影响一行，实际影响了 2 行。两次写入后表单里的值：
  ["做这一页的那天","在一起那天","审计-倒数第二行","审计-倒数第二行"]`。
  定稿版自带 2 条事件的夹具，同一个断言仍然红。
- `F1c`（定稿版实测）：`Expected: 2 / Received: 1` —— 3 行时点 1 次「删除」只剩 1 行。
- `F2c`（定稿版实测）：`Expected: 1 / Received: 0` —— 2 行时点 1 次「删除」剩 0 行。
- `F2a` 的原始证据：`实际有 2 行都变成了「审计-第一行图注」：["审计-第一行图注","审计-第一行图注"]`。
- `F1b` / `F2b` 的原始证据：DOM id 分别重复为 `her-event-title-event-3` ×2、
  `her-photo-caption-photo-1` ×2。

### 与其他 spec 同跑的结果（66 条）

`npx.cmd playwright test e2e/her-routes.spec.ts e2e/her-flows.spec.ts e2e/her-admin.spec.ts e2e/her-audit.spec.ts`
→ **53 passed / 12 failed / 1 skipped**（1.9m）。拆开看：routes 8/8 全绿；flows 20 条里 19 绿、
唯一的红是上面那条连锁（`:412`）；admin 11 条里 10 绿、唯一的红是它自己那条用例（`:515`）；
audit 27 条里 11 绿 / 15 红（那次 A5 与 F2a 受别人残留状态影响，见下面的用例隔离说明）。
修好我的用例隔离问题之后单跑我的 spec 是 15 绿 / 12 红 / 0 跳过。

---

## 3. 缺陷清单（按严重程度排序）

### 缺陷 1（高）后台表单「新增行」的 key 与字段 id 由数组长度派生，删行后再新增会与上一次新增的行重名

**文件:行**
- `src/components/admin/her-form.tsx:314`（事件新行 `key: \`new-event-${current.timeline.length}\``）
- `src/components/admin/her-form.tsx:315`（事件新行 `fieldId: \`event-${current.timeline.length}\``）
- `src/components/admin/her-form.tsx:362`（照片新行 `key: \`slot-${current.photos.length}\``）
- `src/components/admin/her-form.tsx:363`（照片新行 `fieldId: \`photo-${current.photos.length}\``）
- 按 key / 字段 id 匹配的地方：`her-form.tsx:286-291`（`patchTimeline`）、`293-298`（`patchPhoto`）、
  `327-336`（`removeEvent`）、`374-379`（`removePhoto`）
- 字段 id 进 DOM 的位置：`her-form.tsx:605/608/621`（事件）与 `729/732/757/760/773`（照片）
- 相关但不同源的一处：`her-form.tsx:142`（既有照片行的 `fieldId: photo-${index}`，删行后不会重编号）

**最小复现（事件，纯 UI，不需要上传）**
1. 后台 `/admin/her`（种子 3 条事件）。
2. 点「+ 加一条」→ 4 行。
3. 删掉第 2 行 → 3 行。
4. 再点「+ 加一条」→ 第 3、4 行的 key 都是 `new-event-3`（字段 id 都是 `event-3`）。
5. 在第 3 行的「事件名」里输入任意文字。

**实际结果**
- 第 3、4 行的标题**同时**变成刚输入的文字（原始输出见 §2 运行历史）。
- 同一页出现两个相同 DOM id：`her-event-title-event-3` ×2。
- 3 行时点 **1 次**「删除」→ 只剩 **1** 行（期望 2）。

**期望结果**：改第 3 行只影响第 3 行；删除只删被点的那一行；DOM id 唯一。

**照片路径（同源缺陷，真实用户「换一张照片」就会踩到）**
1. 后台点「+ 加一张」→ 新行 key = `slot-1`。
2. 删掉原来那张 → 1 行。
3. 再点「+ 加一张」→ 新行 key 也是 `slot-1`，两行重名。
4. 实测：改第 1 行图注 → 两行都变成「审计-第一行图注」；2 行时点 1 次「删除」→ **0** 行；
   DOM id 重复 `her-photo-caption-photo-1` ×2。

**数据丢失后果（F3a / F3b，已实测）**
- 前置：`photos: [{ file: 'slot-1', src: '/media/her/2026-10-12-01.jpg', eventIso: '2026-10-12' }]`、
  事件 `photos: ['slot-1']`（「已保存过的真实照片」的等价形态；`slot-1` 恰好等于新增行的 key）。
- 步骤：点「+ 加一张」→ 2 行 → 点**空行**的「删除」→ 点保存。
- 实际：真实照片行跟着空行一起消失；写盘结果（原始输出）：
  `{"slug":"her","displayName":"审计专用称呼",…,"timeline":[{"id":"audit-e1","date":"2026 · 10 · 12","iso":"2026-10-12","title":"审计事件一","photos":[]}],"photos":[],"letter":{…}}`
  `/her/photos` 上 `#photo-slot-1` 也消失 —— **用户没删的照片在站点上消失，而且保存成功。**
- 期望：被点的那一行消失，另一张（已保存的照片）保留。

**严重程度**：高（静默数据丢失 + 一次操作改两行/删两行；触发路径就是最普通的「加一条 / 删一条 / 再加一条」）
**缺陷还是设计取舍**：**缺陷**。修复方向（只给方向，不代改）：`fieldId` 改成按**渲染时数组下标**重新计算
（SSR 与 hydration 都从同一份数据派生，天然确定且唯一），React `key` 用运行期唯一值
（`crypto.randomUUID()`，或只用于 key、不拼进 DOM id 的单调计数器），让「行身份」与「文件名 / 事件 id」分开。
**注意不要再回到 `draft-N` 拼字段 id 的老路**（那是已修过的 hydration 缺陷，见 `her-form.tsx:81-88` 的说明）。

---

### 缺陷 2（中）两个标签页同时保存 → 一个标签页报 `ENOENT: … rename 'data\her.json.tmp' -> 'data\her.json'`

**文件:行**
- `src/lib/store/files.ts:52`（`const temp = \`${target}.tmp\``）与 `:54-55`（`writeFile` → `rename`）——`writeCollection`
- `src/lib/store/files.ts:91` 与 `:93-94`——`writeObject`（`data/her.json` 走这条）
- 错误透传：`src/lib/actions/her.ts:66-68`（把 `error.message` 原样返回给表单）

**最小复现**
1. 两个浏览器上下文（两个标签页）分别登录并打开 `/admin/her`。
2. 一边把「称呼」改成 A，另一边改成 B。
3. **几乎同时**点两边的「保存并查看 /her」。

**实际结果**（4 次执行 2 次复现，原始输出）
```
Error: 标签页 B 不该出现保存失败提示；实际：
ENOENT: no such file or directory, rename 'E:\我的个人博客\data\her.json.tmp' -> 'E:\我的个人博客\data\her.json'
```
两个请求都要写同一个固定临时文件名 `her.json.tmp`：先完成的 `rename` 把它搬走，后一个 `rename` 找不到源文件。
同时实测：`data/her.json` 是完整可解析的一份内容、没有 `.tmp` 残留 ——
**写入是安全的，坏的是「失败提示」**。

**期望结果**：两个并发保存都不该报错（或明确提示「内容已被另一个标签页更新，请刷新后重试」），
而不是把英文文件系统错误原样丢给用户。

**严重程度**：中（不是数据损坏；但用户会以为没保存，可能反复重试或误判内容丢失；
线上 Serverless 多实例下的并发窗口比本地更大，风险只增不减 —— 后者是**推断**，我没有线上环境）
**缺陷还是设计取舍**：**缺陷**（并发健壮性）。修法方向：临时文件名加唯一后缀
（`${target}.${randomUUID()}.tmp`）或对同一文件串行化写入；并给 `saveHerProfileAction` 的兜底分支换中文人话。

**对照（说明「双击保存」不容易触发）**：`A4` 在同一个 tick 里派发两次点击 → 实测 Server Action POST 次数 = 2，
两次都成功、无错误提示、无 `.tmp` 残留、文件正确。这条需要**两条真正并发**的请求。

---

### 缺陷 3（中）建页日填未来日期 → 「站在这页上的时间」显示负数（`-45 天`）

**文件:行**
- `src/components/her/her-data.ts:121`（`const standing = daysTogether(today, profile.pageBuiltOn);`）
- `src/components/her/her-data.ts:168`（`value: standing === null ? DATE_PLACEHOLDER : String(standing)`）
- 对照：`src/components/her/her-data.ts:141-155` 对 `since` 已经专门处理 `upcoming`（负数 → 「距离…还有 N 天」），
  `pageBuiltOn` 这条分支漏了；`daysTogether` 的契约见 `src/lib/date/birthday.ts:118-133`（未来返回负数、刻意不夹到 0）

**最小复现**
1. 后台 `/admin/her` → 「建页日」（`#her-built-on`，`type="date"`，**没有上限**）填今天 + 45 天（本次 `2026-11-26`）。
2. 点保存 → 保存成功（写盘 `pageBuiltOn: "2026-11-26"`、`heroYear: "2027"`）。
3. 打开 `/her` 看第二张卡。

**实际结果**（原始输出）：卡片主值 `-45`，单位「天」，label「站在这页上的时间 · 建页纪念日」。
**期望结果**：不能出现负数（应像 `since` 那样显示「距离…还有 N 天」，或退回「待填」）。
**严重程度**：中（后台日期选择器很容易手滑选到未来；页面上「一眼就是坏掉的数字」，而代码注释明确说这种事不能发生）
**缺陷还是设计取舍**：**缺陷**（同一份数据里两条分支口径不一致）。

---

### 缺陷 4（低）生日填 2-29：卡片写「下一次落在 2027 年 2 月 29 日」，倒计时实际落在 2027-02-28

**文件:行**
- `src/components/her/her-data.ts:120`（`const birthdayLabel = \`${profile.birthday.month} 月 ${profile.birthday.day} 日\`;`）
- `src/components/her/her-data.ts:131`（`note: \`下一次落在 ${birthday.nextOccurrenceYear} 年 ${birthdayLabel}\``）
- 算法侧：`src/lib/date/birthday.ts:53-61`（`occurrenceOf` 把 2-29 在平年收拢到 2-28）与 `:93-116`（`describeBirthday`）

**最小复现**：后台把生日改成 2 月 29 日（zod 与 UI 都允许）→ 保存 → 打开 `/her`。
**实际结果**（原始输出）：
```
Received string: "139天距离下一次生日 · 2 月 29 日下一次落在 2027 年 2 月 29 日"
```
而 `describeBirthday` 的落点是 **2027-02-28**（2027 不是闰年，2 月 29 日不存在）。
**期望结果**：文案写算法真正落到的日子（2027 年 2 月 28 日）。
**严重程度**：低（只影响 2-29 生日且目标年份为平年；文案层而非数据层）
**缺陷还是设计取舍**：**缺陷**（文案与算法不一致）。
用例 `C6` 用 `occurrenceOf(nextOccurrenceYear, birthday)` 现算期望值，闰年跑会自然变绿，不是写死 2027。

---

### 缺陷 5（低）超长且不可断行的文本撑破布局：三页在 390px **与 1280px** 都出现横向滚动

**文件:行**
- `app/her/page.tsx:50-52`（副标题 `p.mt-4.max-w-xl`，无 `break-words`）
- `src/components/her/her-timeline.tsx:43`（`div.min-w-0`）+ `:51`（事件名 `h3`：`min-w-0` 只让容器收缩，词本身不换行）
- `src/components/her/her-photo-viewer.tsx:239`（图注 `figcaption.mt-2`）；组标题链接 `:196-205`
- `src/components/her/her-letter.tsx:32-38`（`.rich-text` 正文段落）
- 全局：`app/globals.css:55-199` 的 `.rich-text` 规则里**没有任何** `overflow-wrap` / `word-break`

**最小复现**：内容里只放一个超长不可断行字段（长度都在 zod 允许范围内），
在 390×844 与 1280×800 分别打开三页，量 `document.documentElement.scrollWidth`。
**实际结果**（一次只放一个字段）
| 内容 | 页面 | 390px | 1280px | 定位到的溢出元素 |
| --- | --- | --- | --- | --- |
| 事件名 120 个 `A`（上限 120） | `/her` | 1475 / 390 | 1747 / 1280 | `ol.relative` 内容超出 1101px |
| 事件名 120 个 `A` | `/her/photos` | 1523 / 390 | 1779 / 1280 | `section.border-t` 超出 1149px |
| 图注 500 个 `B`（上限 500） | `/her/photos` | 3781 / 390 | 4037 / 1280 | `figcaption.mt-2` 比容器宽 3530px |
| 副标题 200 个 `D`（上限 200） | `/her` | 2454 / 390 | 2710 / 1280 | `p.mt-4` 比容器宽 1862px |
| 信正文 4000 个 `C`（上限 4000） | `/her/letter` | 43196 / 390 | 43452 / 1280 | `div.rich-text` 比容器宽 42822px |

**期望结果**：没有横向滚动（`scrollWidth ≤ clientWidth`）。
**严重程度**：低-中（普通中文会正常换行，触发条件是长串不含空格的 URL / 粘贴内容；
一旦触发，手机整页左右拖动、桌面也要横滚 3000+ px）
**缺陷还是设计取舍**：**缺陷**（排版健壮性）。修法方向：给事件名/副标题/图注/`.rich-text` 加
`break-words`（或 `overflow-wrap: anywhere`），可优先在 `.rich-text` 与时间线标题上加规则。

---

### 外部发现（不是我改的范围，但必须让 Lead 知道）

`e2e/her-admin.spec.ts:515`「同一事件挂两张照片：两张都保住归属并在照片墙同组显示（小泽报的 bug 回归）」
—— 这条是别人在我审计期间新加的（我读到该文件时只有 514 行），**它现在是红的**，而且**不是产品缺陷**：

- 我单独跑它：1 failed（7.1s），失败点是 `e2e/her-admin.spec.ts:592`：
  `locator('section[aria-labelledby="her-group-page-built"]').locator('li[id^="photo-"]')`
  `Expected: 2 / Received: 3`。
- 原因：`timeline[0]`（`page-built`）**本来就已经挂着种子照片** `2026-10-12-01.jpg`，
  用例又往同一条事件加了 2 张，所以那一组里是 3 张而不是 2 张。
- **它的数据层断言全部通过了**（`after.photos.length === beforeCount + 2`、两张上传文件都在该事件的
  `photos` 里、`orphans` 为空）——也就是说**「同一事件挂两张照片」在数据层没有丢归属**，
  红的是那句 DOM 计数。这正是小泽报的现象所对应的回归闸门，建议 owner 把计数改成
  「该事件原本挂的照片数 + 2」（或在开头先记录 `firstEvent.photos?.length`）即可。
- **连锁影响（实测）**：它失败前不会执行末尾的清理（`:608-615`），于是把 2 张上传照片留在 `data/her.json`，
  导致：
  1. `e2e/her-flows.spec.ts:412`「照片文件真实存在且能被服务端返回」变红 —— 那条按
     `/media/her/<file>` 去请求，而上传照片的 `src` 是 `/media/<uuid>.png`（不在 `/media/her` 下）→ 404；
  2. 我的 `E1`（要求「正好 1 张照片」）被 skip —— 我已经把 E1 等用例改成**自带夹具**，不再受它影响。
  合并跑一次的结果是 `53 passed / 12 failed / 1 skipped`：12 个红里 11 个是我的、1 个是它。
  建议：这条用例失败时也应清理（或改 `expect.soft`），否则一个红会带红别人两条。

---

## 4. 「查过、未发现」的方向（每条都写清探测手段）

1. **多张照片 / 多个事件的组合与二次保存（刚修过缺陷的邻近场景）** —— `A1` 通过。
   手段：造「事件一挂 2 张 + 待填事件挂 0 张 + 第 3 张未归属」，在后台把未归属那张挂到事件一 → 保存 →
   **重新加载表单** → 断言 3 行的 select 都还是 `audit-e1`、行头显示「已挂 3 张照片」→ 再保存一次，
   断言写盘 JSON 与上一次 **deep-equal**（零字段漂移）→ 公开页三张都在该组、尾组消失、时间线缩略图取 `photos[0]`。
2. **照片在事件之间来回改归属** —— `A2` 通过。手段：从「有精确日期的事件」改到「待填事件」→
   断言 `eventIso` 变 `null`、公开页从 e1 组移到 e2 组；再改回 → 断言 `eventIso` 重新派生为 `2026-10-12`、e2 组变空。
3. **删除挂着照片的事件后照片去哪了** —— `A3` 通过：照片行不被删、select 退回「（还没归到事件）」、
   保存被明确拦下（中文原因）、改挂到别的事件后能存。
4. **改事件锚点 id 的连锁** —— `B1` 通过。手段：`audit-e1` → `audit-e1-renamed` → 断言数据里 id 变了而
   `photos` 归属不变；`/her` 上只有新 id 的元素、旧 id 元素数为 0；`/her/photos` 组标题回链指新 id、
   **指旧 id 的链接数为 0（无死链）**；真的点一遍回链落到新锚点且进入视口；
   时间线缩略图 → 照片墙锚点这条链（只依赖文件名）不受影响。
5. **非法锚点 id** —— `B2` 通过：填 `Bad ID` → 整份拒绝保存、提示含 id/锚点、`data/her.json` **字节级不变**。
6. **重复保存的幂等性** —— `A1`（连存两次 deep-equal）+ `A4`（同 tick 两次点击 → 2 次 POST、都成功、
   无 `.tmp` 残留、文件可解析、无错误提示）通过。（并发场景见缺陷 2，那是真的缺陷。）
7. **空与极值** —— `C1`–`C5` 通过：删光事件只剩照片（照片全落在「还没归到事件里」尾组、计数按渲染数、
   `/her` 显示时间线空状态）；删光照片（事件 `photos` 引用一并清空、`/her` 显示「待补」且不渲染 `<img>`、
   主页「全部 N 张」入口消失、照片墙空状态）；信只填引用（渲染 `blockquote`，**不**显示「这封信还没写完」）；
   称呼首尾空格（写盘即 trim，页面文本无可见空白）；纪念日填未来日期（「距离在一起纪念日」+ 正数 `45`，无负数）。
8. **公开页 HTML / 脚本注入** —— `D1` 通过。手段：事件名、图注、信正文里分别塞
   `<img src=x onerror="window.__auditXss=…">`、`<script>window.__auditXss=2</script>`、`<b>`/`<i>`/`<u>`；
   三页都断言 `window.__auditXss === undefined`、`img[src="x"]` 数为 0、无脚本元素、
   段落 `innerText` 与写入内容**完全一致**（React 文本转义生效，没有被当 HTML 执行）。
9. **查看器边界** —— `E1`–`E3` 通过：单张照片按 4 次左右键始终 `1 / 1`、`img.src` 不变；
   3 张跨 2 组（含未归属尾组）序号与图注同步、跨组正确、末尾「下一张」循环回 `1 / 1`、
   第 1 张「上一张」回到 `3 / 3`、尾组照片不残留上一张的事件行；
   连按 6 次 Tab + 4 次 Shift+Tab，`document.activeElement` 每次都仍在 `[role=dialog]` 内，Esc 仍能关。
10. **既有的数据源容错 / hydration 确定性**：`her-admin.spec.ts` 已覆盖（坏 JSON、缺文件、hydration、
    字段 id 唯一性），本次未重复；但注意 `her-admin.spec.ts:406-449` 那条「字段 id 唯一」用例只查了
    **没有删行**的初始状态，所以它绿着而缺陷 1 依然存在 —— 缺陷 1 修好后建议把 F1b/F2b 一起纳入回归。

---

## 5. 我无法覆盖的方向及原因

1. **真实上传路径（`uploadMediaAction`）**：它会往 `public/media/<uuid>.<ext>` 写文件，而我的写入范围不含
   `public/`，因此**没有走真实上传**（也没有制造任何 `public/media` 新文件）。
   等价状态改用「预置数据 + 直接操作表单」覆盖（照片 `src` 指向真实存在的 `/media/her/2026-10-12-01.jpg`，
   保证 `<img>` 能解码、不引入 404 噪音）。由此，下面这条只是**推断、未实测**：
   两行照片重名时，往其中一行上传会把 `patchPhoto(key)` 同时应用到两行（`her-form.tsx:293-298`），
   两行拿到同一个 `file`，保存时被 `src/domain/her-schemas.ts:127-130`「photos 里的文件名不能重复」
   整份拒绝 → 表现是「传了图却存不下来」。同一条 `patchPhoto` 路径在 F2a 已用「改图注」实测到「一次改两行」。
2. **线上（Vercel + Supabase）**：`src/lib/content/her-source.ts` 只有本地文件这一条路（文件注释已注明
   Supabase 未接入）。**推断（未实测、无线上权限）**：线上后台改「她」的内容会走 `writeObject` 写
   `data/her.json`，在 Serverless 环境里要么因只读文件系统报错（用户看到 `EROFS` 一类英文错误）、
   要么只写在临时实例里而随后丢失；也就是说「后台可编辑」这条能力在线上可能不成立。
   这与文章走 Supabase（能持久化）不是同一套存储，所以**不能用文章的线上表现推断「她」也能存**。
   建议上线前用一次真实线上保存验证，或明确把「她」的编辑限定为本地。
3. **5 MiB 边界大图**：`validateImageUpload` 有单测，E2E 未跑（同第 1 条原因）。
   已修的「请求体 6mb」改动本次未回归（不在我的审计方向）。
4. **多进程 / 多实例并发保存**：本地只有一个 dev 进程，我只测到「两个标签页」（缺陷 2，2/4 次复现）。
5. **视觉细节**：只做「是否横向滚动」的量化检查，没有逐像素截图比对。
6. **移动端项目下的 her 页面**：`playwright.config.ts` 的 `mobile` 项目 `testMatch` 只匹配 `zz-public.spec.ts`；
   我在 `D2` 里用 `page.setViewportSize(390×844)` 在桌面项目内覆盖了布局量测，
   但没有用 `isMobile/hasTouch` 的真机语义。

---

## 6. 一句话结论

**不能算「上线前没有已知的阻断性缺陷」**：`e2e/her-audit.spec.ts` 定稿版是 **15 绿 / 12 红 / 0 跳过**，
其中 8 条红来自同一个**高危**根因（后台表单新增行的 key 与字段 id 由数组长度派生 →
「加一条 → 删一条 → 再加一条」之后改一行改两行、删一行删两行，并且可以静默删掉一张**已经保存过**的真实照片
且保存成功），另有「两个标签页同时保存报 ENOENT（4 次里 2 次复现，内容未损坏但用户会以为没保存）」、
「建页日填未来日期显示 `-45 天`」、「超长不可断行文本让三页在两视口都横向撑破」、
「生日 2-29 在平年写成不存在的 2 月 29 日」。
缺陷 1 修完之前，任何「在后台加过事件/照片又删过其中一行」的会话都可能丢数据，**建议视为上线阻断项**。
