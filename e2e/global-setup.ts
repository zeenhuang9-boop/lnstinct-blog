import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 每个 E2E 运行开始时重置本地内容，保证测试数据独立、可重复。
 * 仅重置 data/ 下的内容文件与「她」页面的数据，不动媒体与源码。
 *
 * 「她」（`data/her.json`）特殊处理：内容可以**在网站后台编辑**，所以测试会写它。
 * 用户真实内容不能被打坏，因此这里不重置而是「接管 + 跑完还原」：
 * - globalSetup：把现有 `her.json` 备份到 `.her-seed-backup.json`，并写入一份确定的测试数据；
 * - globalTeardown（`e2e/global-teardown.ts`）：原来没有就删掉，原来有就原样还原。
 * 备份文件用点号开头，`readObject('her')` 这类按名读取不会碰到它。
 *
 * ── 为什么要有进程锁 ──────────────────────────────────────────────
 * 「接管 + 还原」这套依赖「备份文件只被本轮写过」这个前提。两轮 playwright 同时跑时：
 * 后启动的那次会把**前一次写的测试种子**当成用户内容复制进同一个备份文件，
 * 两次 teardown 都还原种子 —— 用户的真实内容就永久丢了。
 * 所以这里用 `wx` 独占创建 `data/.her-seed.lock`：拿不到锁就直接失败，
 * 而不是「礼貌地继续写」。锁由 teardown 释放。
 */
const LOCK_NAME = '.her-seed.lock';

function lockPath(dataDir: string): string {
  return path.join(dataDir, LOCK_NAME);
}

/** 锁文件里记的是持有者 pid；上一个进程已经退出（异常中断）时不该让下一轮干等。 */
function holderIsAlive(holderPid: number): boolean {
  if (!Number.isInteger(holderPid) || holderPid <= 0) {
    return false;
  }

  try {
    process.kill(holderPid, 0); // 只探测存在性，不真的发信号
    return true;
  } catch {
    return false;
  }
}

export default function globalSetup(): void {
  const dataDir = process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });

  // 独占拿锁：存在即说明有另一轮 E2E 正在运行。
  try {
    writeFileSync(lockPath(dataDir), `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch {
    const holderRaw = existsSync(lockPath(dataDir)) ? readFileSync(lockPath(dataDir), 'utf8').trim() : '';
    const holderPid = Number.parseInt(holderRaw, 10);

    if (holderIsAlive(holderPid)) {
      throw new Error(
        `已有另一轮 E2E 正在运行（锁文件 ${lockPath(dataDir)}，持有者 pid=${holderPid}）。\n` +
          '并发运行会让「她」的真实内容被测试种子覆盖后无法还原，所以这里直接拒绝启动。\n' +
          '请等那一轮结束再跑。',
      );
    }

    // 持有者已经不在了：这是上一次异常中断留下的锁，接管它。
    console.warn(
      `[global-setup] 发现残留锁（pid=${holderRaw || '未知'} 已不存在），已接管。` +
        '若上一次是异常中断，请确认 data/her.json 是否还是你的真实内容。',
    );
    writeFileSync(lockPath(dataDir), `${process.pid}\n`, 'utf8');
  }

  writeFileSync(path.join(dataDir, 'posts.json'), '[]\n', 'utf8');
  writeFileSync(path.join(dataDir, 'projects.json'), '[]\n', 'utf8');

  const herFile = path.join(dataDir, 'her.json');
  const backup = path.join(dataDir, '.her-seed-backup.json');
  const hadRealData = existsSync(herFile);

  if (hadRealData) {
    copyFileSync(herFile, backup);
  }

  // 测试专用的确定数据：称呼固定，其余与 src/content/her.ts 的默认值同构。
  const seed = {
    slug: 'her',
    displayName: 'E2E 测试称呼',
    tagline: 'E2E 测试副标题。',
    birthday: { month: 10, day: 11 },
    since: null,
    pageBuiltOn: '2026-10-12',
    heroYear: '2026',
    timeline: [
      {
        id: 'page-built',
        date: '2026 · 10 · 12',
        iso: '2026-10-12',
        title: '做这一页的那天',
        photos: ['2026-10-12-01.jpg'],
      },
      { id: 'first-meeting', date: null, iso: null, title: '第一次见面', photos: [] },
      { id: 'together', date: null, iso: null, title: '在一起那天', photos: [] },
    ],
    photos: [{ file: '2026-10-12-01.jpg', eventIso: '2026-10-12' }],
    letter: { salutation: 'E2E 测试称呼：', paragraphs: [] },
  };

  writeFileSync(herFile, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  writeFileSync(
    path.join(dataDir, '.her-seed-state.json'),
    `${JSON.stringify({ hadRealData }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(path.join(dataDir, '.global-setup-ran'), new Date().toISOString(), 'utf8');

  console.log(
    `[global-setup] reset data at ${dataDir}（她：${hadRealData ? '已备份真实内容，测试后还原' : '原无文件，测试后删除'}）`,
  );
}

/** 验证用：读回测试期间实际生效的「她」内容文件（避免测试各自按路径硬编码）。 */
export function readSeededHerFile(): unknown {
  const dataDir = process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
  return JSON.parse(readFileSync(path.join(dataDir, 'her.json'), 'utf8')) as unknown;
}
