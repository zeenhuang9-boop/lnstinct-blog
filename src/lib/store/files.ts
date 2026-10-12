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

/**
 * data/ 下某个数据文件的绝对路径。
 * 单对象（`data/her.json`）与集合（`data/posts.json`）共用同一套命名规则：`<name>.json`。
 */
export function dataFilePath(name: string): string {
  return collectionFile(name);
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

/**
 * 临时文件名：**每个写入者一套**，不能共用固定的 `x.json.tmp`。
 *
 * 历史缺陷（审计发现）：两个标签页几乎同时保存时，两边都写同一个 `.tmp`，
 * 先完成的一方 rename 走之后，另一方 rename 就会 `ENOENT`，用户看到的是
 * 一个吓人的英文报错。数据本身没坏（原子写仍是原子的），坏的是可用性。
 * 加 pid + 随机尾缀后两次写入互不干扰，仍然是「写完再原子替换」。
 */
function tempFileFor(target: string): string {
  const unique = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  return `${target}.${unique}.tmp`;
}

/**
 * 原子替换：写完临时文件后 rename 到目标。
 *
 * Windows 上 rename 覆盖一个已存在的文件会偶发 `EPERM`（杀软或文件监视器短暂持有句柄，
 * 审计里两个标签页同时保存就撞到过），而这不是数据问题、重试一次就好。
 * 所以这里做有界重试（只对 EPERM/EBUSY/EACCES，最多 5 次、间隔递增）；
 * 其它错误（例如目录不存在）立即抛出，不做无意义的等待。
 * 失败时清理临时文件，不留下 `.tmp` 垃圾。
 */
async function renameWithRetry(temp: string, target: string): Promise<void> {
  const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rename(temp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';

      if (!RETRYABLE.has(code) || attempt === 4) {
        await fs.rm(temp, { force: true }).catch(() => undefined);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

export async function writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
  await ensureDataDir();

  const target = collectionFile(name);
  const temp = tempFileFor(target);

  await fs.writeFile(temp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  await renameWithRetry(temp, target);
}

/**
 * 读单个 JSON 对象（`data/<name>.json` 里存的是一个对象，不是数组）。
 * 文件不存在、JSON 损坏或顶层不是对象时返回 null —— 只保证「对象或 null」，
 * **不做字段校验**（字段校验交给 zod，见 `src/domain/her-schemas.ts`）。
 * 与 `readCollection` 一样刻意不做进程内缓存；损坏的文件原样留在磁盘上，不在这里改写。
 */
export async function readObject<T>(name: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(dataFilePath(name), 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * 写单个 JSON 对象：临时文件 + 原子重命名，与 `writeCollection` 同一套写法。
 * 传数组或 null 直接抛错，避免写出「读回来是 null」的半截数据。
 */
export async function writeObject<T>(name: string, value: T): Promise<void> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('writeObject 只接受 JSON 对象；数组请用 writeCollection。');
  }

  await ensureDataDir();

  const target = dataFilePath(name);
  const temp = tempFileFor(target);

  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await renameWithRetry(temp, target);
}

/** 兼容旧测试接口：已无进程内缓存，保留为空操作。 */
export function clearCollectionCache(): void {
  // 无缓存可清。
}
