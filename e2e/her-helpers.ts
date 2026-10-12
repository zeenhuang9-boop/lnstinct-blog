import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * 「她」页面 E2E 的公共工具。
 *
 * 只放与具体 DOM 无关的稳定逻辑：时区换算、console 错误采集、锚点定位。
 * 选择器与断言写在各自的 her-*.spec.ts 里，实现改动时只需改 spec，不动这里。
 */

/** 全站固定时区（见 src/lib/date-time.ts）。倒计时的「今天」必须按这个时区取。 */
export const SITE_TIME_ZONE = 'Asia/Shanghai';

/**
 * 取某时区下「今天」的年月日。
 *
 * 不能用 `new Date()` 的本地字段：Playwright 在 UTC 环境下跑时，
 * 上海时间 00:00–08:00 这一段会与页面算出的日期差一天，倒计时断言就会假红。
 */
export function todayInTimeZone(timeZone: string = SITE_TIME_ZONE): {
  year: number;
  month: number;
  day: number;
} {
  // en-CA 的短日期格式为 YYYY-MM-DD，直接切分即可，不依赖运行环境的 locale 解析。
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [year, month, day] = formatted.split('-').map((part) => Number(part));
  return { year, month, day };
}

/**
 * 页面上的 console 错误与未捕获异常采集器。
 *
 * 用法：
 *   const errors = collectConsoleErrors(page);
 *   ...
 *   expectNoPageErrors(errors);
 */
export type PageErrorLog = {
  /** console.error 的文本（含首个参数以外的其余参数，便于看到堆栈） */
  consoleErrors: string[];
  /** pageerror 事件：未捕获异常 / hydration 崩溃 */
  pageErrors: string[];
};

/**
 * 已知噪音：dev 模式（playwright.config.ts 用 `npm run dev`）下与实现无关的告警。
 * 只抑制确定来自框架而非页面的项；不确定的一律保留，宁可红也不要掩盖真问题。
 */
const KNOWN_NOISE: readonly RegExp[] = [
  // React DevTools 提示，仅在开发模式出现。
  /Download the React DevTools/i,
  // Turbopack / Next dev 的 HMR websocket 重连日志。
  /\[HMR\]|webpack-hmr|WebSocket connection to .*_next\/webpack-hmr/i,
];

/** 判断一条 console 文本是否属于框架噪音（页面级报错不应命中）。 */
export function isKnownNoise(message: string): boolean {
  return KNOWN_NOISE.some((pattern) => pattern.test(message));
}

/**
 * 已确认的既有缺陷（**不是**「她」页面引入的）：仓库里没有任何 favicon 资产
 * （`app/favicon.ico`、`app/icon.*`、`public/favicon.ico` 全都不存在），
 * 浏览器自动请求 `/favicon.ico` 得到 404，时有时无（取决于缓存与请求时机）。
 *
 * 处理方式：在收集错误前把**这一个**请求挡掉（返回 204），
 * 而不是靠字符串白名单把 404 文本吞掉 —— 这样「照片 404」「脚本 404」照样会让测试红，
 * 只有 favicon 这一条不发生。该缺陷已记入 `docs/her-verify-report.md`，归全站范围。
 */
const FAVICON_PATTERN = /\/favicon\.ico(\?|$)/;

export function collectConsoleErrors(page: Page): PageErrorLog {
  const log: PageErrorLog = { consoleErrors: [], pageErrors: [] };

  // 挡住浏览器自动发的 favicon 请求（它不属于页面实现）。
  void page.route(FAVICON_PATTERN, (route) => route.fulfill({ status: 204, body: '' }));

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    const text = [
      message.text(),
      ...message.args().map((arg) => {
        try {
          return String(arg);
        } catch {
          return '';
        }
      }),
    ]
      .filter(Boolean)
      .join(' ');

    if (!isKnownNoise(text)) {
      log.consoleErrors.push(text);
    }
  });

  page.on('pageerror', (error) => {
    const text = `${error.name}: ${error.message}`;
    if (!isKnownNoise(text)) {
      log.pageErrors.push(text);
    }
  });

  return log;
}

/** 断言采集期内没有页面级错误。失败时把完整原文贴出来，不截断。 */
export function expectNoPageErrors(log: PageErrorLog): void {
  expect(
    log.pageErrors,
    `页面出现未捕获异常：\n${log.pageErrors.join('\n---\n')}`,
  ).toHaveLength(0);

  expect(
    log.consoleErrors,
    `页面出现 console 错误：\n${log.consoleErrors.join('\n---\n')}`,
  ).toHaveLength(0);
}

/** 把照片文件名换算成照片墙上的锚点 id：`2026-10-11-01.jpg` → `photo-2026-10-11-01-jpg`。 */
export function photoAnchorId(fileName: string): string {
  return `photo-${fileName.replace(/\./g, '-')}`;
}
