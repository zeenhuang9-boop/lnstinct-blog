import { existsSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * E2E 跑完的收尾：把「她」（`data/her.json`）恢复成测试前的样子，并释放进程锁。
 *
 * 对应 `e2e/global-setup.ts` 的接管逻辑：
 * - 测试前有真实内容 → 从 `.her-seed-backup.json` 原样还原；
 * - 测试前没有这个文件 → 删掉测试数据，回到「没有文件」的状态。
 *
 * 两条纪律：
 * 1. 任何一条路径失败都要说清楚，不能静默——用户的内容比测试体面更重要；
 * 2. **只要还有可能要从备份恢复，就绝不删备份**。只有在「已确认还原成功」或
 *    「本来就没有真实内容可还原」时才清理，否则把当前占用它的人（下一次运行）坑死。
 */
export default function globalTeardown(): void {
  const dataDir = process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
  const herFile = path.join(dataDir, 'her.json');
  const backup = path.join(dataDir, '.her-seed-backup.json');
  const stateFile = path.join(dataDir, '.her-seed-state.json');
  const lockFile = path.join(dataDir, '.her-seed.lock');

  // 备份是否可以安全删除：只有确认「不再需要它」时才置为 true。
  let backupConsumed = false;

  try {
    if (!existsSync(stateFile)) {
      console.warn('[global-teardown] 没有找到 .her-seed-state.json，跳过「她」的还原（可能 globalSetup 未执行）。');
      // 不碰备份：万一是 setup 中途失败留下的，它是唯一的真实内容副本。
      return;
    }

    const raw = readFileSync(stateFile, 'utf8');
    const hadRealData = (JSON.parse(raw) as { hadRealData?: boolean }).hadRealData === true;

    if (hadRealData) {
      if (existsSync(backup)) {
        copyFileSync(backup, herFile);
        backupConsumed = true;
        console.log('[global-teardown] 已还原测试前的 data/her.json');
      } else {
        console.warn('[global-teardown] 备份文件丢失，无法还原 data/her.json —— 请检查 data/.her-seed-backup.json');
      }
    } else {
      if (existsSync(herFile)) {
        rmSync(herFile);
        console.log('[global-teardown] 已删除测试写入的 data/her.json（测试前不存在）');
      }

      backupConsumed = true;
    }
  } finally {
    // 状态文件与锁一定要清（否则下一轮会被自己的锁挡住）；
    // 备份只在确认不需要时才清。
    for (const temp of [stateFile, lockFile]) {
      if (existsSync(temp)) {
        rmSync(temp);
      }
    }

    if (backupConsumed && existsSync(backup)) {
      rmSync(backup);
    } else if (existsSync(backup)) {
      console.warn(`[global-teardown] 保留了备份 ${backup} —— 它是你的真实内容副本，确认无误后再手动删除。`);
    }
  }
}
