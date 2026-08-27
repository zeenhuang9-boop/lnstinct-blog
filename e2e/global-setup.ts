import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * 每个 E2E 运行开始时重置本地内容，保证测试数据独立、可重复。
 * 仅重置 data/ 下的内容文件，不动媒体与源码。
 */
export default function globalSetup(): void {
  const dataDir = process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, 'posts.json'), '[]\n', 'utf8');
  writeFileSync(path.join(dataDir, 'projects.json'), '[]\n', 'utf8');
  writeFileSync(path.join(dataDir, '.global-setup-ran'), new Date().toISOString(), 'utf8');
  console.log('[global-setup] reset data at', dataDir);
}
