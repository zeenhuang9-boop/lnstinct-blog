import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 本地文件存储：用于没有 Supabase 凭据时的本地验收。
 * 每个集合对应 data/ 下的一个 JSON 数组文件；写入采用临时文件 + 原子重命名，
 * 避免进程中断产生半截文件。
 *
 * 刻意不做进程内缓存：Next dev（Turbopack）下模块可能被重新求值、多个实例并存，
 * 缓存会导致“写入后公开页仍读到旧数据”的一致性问题；本地 JSON 很小，直接读盘即可。
 */
function dataDir(): string {
  return process.env.LNSTINCT_DATA_DIR?.trim() || path.join(process.cwd(), 'data');
}

function collectionFile(name: string): string {
  return path.join(dataDir(), `${name}.json`);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function readCollection<T>(name: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(collectionFile(name), 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as T[];
  } catch {
    // 文件不存在或损坏时按空集合处理；损坏时保留现场，避免静默覆盖。
    return [];
  }
}

export async function writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
  await ensureDataDir();

  const target = collectionFile(name);
  const temp = `${target}.tmp`;

  await fs.writeFile(temp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
}

/** 兼容旧测试接口：已无进程内缓存，保留为空操作。 */
export function clearCollectionCache(): void {
  // 无缓存可清。
}
