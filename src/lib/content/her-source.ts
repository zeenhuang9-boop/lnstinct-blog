import { access } from 'node:fs/promises';

import { herProfile, type HerEvent, type HerProfile } from '@/content/her';
import { herProfileSchema } from '@/domain/her-schemas';
import { HerCloudError, getHerCloudStore, type HerCloudStore } from '@/lib/content/her-cloud';
import { dataFilePath, readObject, writeObject } from '@/lib/store/files';

/**
 * 「她」三页的内容来源。
 *
 * 读取顺序（2026-10-12 起）：
 * 1. **配了 Supabase → 先读云端**（`her_profile` 表，见 `her-cloud.ts`）。这是线上唯一能持久的路：
 *    Vercel 的文件系统是临时的，写本地文件会在下一次请求/重新部署后消失。
 * 2. 云端没有这一行 / 表还没建 → 读 `data/her.json`（本地开发与后台改过的内容）。
 * 3. 都没有 / 坏掉 / zod 校验不过 → 回退 `src/content/her.ts` 的默认内容，原因放在 `problem` 里。
 *
 * 四条边界：
 * - **不静默覆盖**：坏文件原样留在磁盘上，这里只读不写；要覆盖只能由后台保存动作显式写入。
 * - **不做进程内缓存**：与 `src/lib/store/files.ts` 一致（Next dev 下模块可能被重新求值、多实例并存，
 *   缓存会导致「刚保存完，页面还是旧内容」）。
 * - **顺序的权威在这里**：`timeline` 一律归一化成「`iso` 降序、`null` 排最后」，页面按数组顺序渲染、
 *   不再自己排序（读写两条路都过同一个函数，手改过的文件也会被纠正）。
 * - **云端坏了要说清楚**：`problem` 里给出「表还没建，请跑 0002 迁移」这类可执行的提示，
 *   而不是把英文报错丢给用户；同时**降级到本地文件**，不让线上直接白屏或保存失败。
 *
 * 依赖注入：`readHerProfile(cloud)` / `saveHerProfile(input, cloud)` 接受可选的云端存储，
 * 默认走 `getHerCloudStore()`（配了 Supabase 才有值）。测试用假实现注入，不需要真连数据库。
 */

/** `data/her.json` 的文件名（不含扩展名）。 */
export const HER_DATA_NAME = 'her';

export type HerProfileProblemKind = 'missing' | 'unreadable' | 'invalid' | 'cloud';

export type HerProfileProblem = {
  readonly kind: HerProfileProblemKind;
  /** 给人看的一句话原因（后台可以直接显示） */
  readonly message: string;
  /** 出问题的文件绝对路径（missing 时是它本该在的位置），用于保留现场与后台提示 */
  readonly file: string;
};

export type HerProfileSource = 'file' | 'default' | 'cloud';

export type HerProfileReadResult = {
  readonly profile: HerProfile;
  readonly source: HerProfileSource;
  /** 正常读到就是 null */
  readonly problem: HerProfileProblem | null;
};

/** 默认内容（`src/content/her.ts`）：首次保存之前、以及云端与文件都不可用时的回退。 */
export function defaultHerProfile(): HerProfile {
  return herProfile;
}

/**
 * 读当前内容，并说明它是从哪来的。
 * 页面只需要内容时用 `getHerProfile()`；后台要提示「表没建 / 文件坏了，现在显示的是默认内容」时用这个。
 */
export async function readHerProfile(cloud: HerCloudStore | null = getHerCloudStore()): Promise<HerProfileReadResult> {
  const file = dataFilePath(HER_DATA_NAME);

  // 1) 云端优先：线上只有这条路能持久。
  if (cloud !== null) {
    const cloudResult = await readFromCloud(cloud, file);

    if (cloudResult !== null) {
      return cloudResult;
    }

    // 云端通、但这一行还没建：这时**不应该**说「还没有 her.json」（线上根本没有那个文件），
    // 而是明确告诉后台「云端还没有内容，先在后台保存一次」。
    return {
      profile: defaultHerProfile(),
      source: 'default',
      problem: {
        kind: 'cloud',
        message: `${cloud.label} 里还没有「她」的内容（云端是空的），现在显示默认内容；在后台保存一次就会写入云端。`,
        file,
      },
    };
  }

  // 2) 本地文件（没配 Supabase 时的唯一来源）。
  if (!(await fileExists(file))) {
    return {
      profile: defaultHerProfile(),
      source: 'default',
      problem: {
        kind: 'missing',
        message: `还没有 ${HER_DATA_NAME}.json，现在用的是 src/content/her.ts 里的默认内容。`,
        file,
      },
    };
  }

  const raw = await readObject<unknown>(HER_DATA_NAME);

  if (raw === null) {
    return {
      profile: defaultHerProfile(),
      source: 'default',
      problem: {
        kind: 'unreadable',
        message: `${HER_DATA_NAME}.json 不是合法的 JSON 对象，已保留现场（没有覆盖它），现在用的是默认内容。`,
        file,
      },
    };
  }

  const parsed = herProfileSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      profile: defaultHerProfile(),
      source: 'default',
      problem: {
        kind: 'invalid',
        message: `${HER_DATA_NAME}.json 校验不过（${summarizeIssues(parsed.error)}），已保留现场，现在用的是默认内容。`,
        file,
      },
    };
  }

  // 这里的类型标注是编译期对账：schema 的输出必须能直接当 HerProfile 用。
  const profile: HerProfile = withTimelineOrder(parsed.data);

  return { profile, source: 'file', problem: null };
}

/** 页面用的入口：永远返回一份可渲染的内容（读不到就用默认内容），永不返回 null。 */
export async function getHerProfile(cloud: HerCloudStore | null = getHerCloudStore()): Promise<HerProfile> {
  const { profile } = await readHerProfile(cloud);

  return profile;
}

/**
 * 后台保存：**先过 zod 再写**，校验不过直接抛错、不落盘（避免写坏数据让页面回退成默认内容）。
 * 写之前把 `timeline` 归一化成「`iso` 降序、`null` 排最后」。
 * 配了 Supabase 就写云端（线上唯一能持久的地方），否则写 `data/her.json`。
 */
export async function saveHerProfile(
  input: unknown,
  cloud: HerCloudStore | null = getHerCloudStore(),
): Promise<HerProfile> {
  const parsed = herProfileSchema.parse(input);
  const profile: HerProfile = withTimelineOrder(parsed);

  if (cloud !== null) {
    await cloud.save(profile);

    return profile;
  }

  await writeObject(HER_DATA_NAME, profile);

  return profile;
}

/**
 * 从云端读一份：返回 `null` 表示「云端没有可用内容，请继续走本地文件」。
 * 云端出问题（表没建、读写失败）时不抛给页面，而是降级——线上宁可显示默认内容，也不该白屏。
 */
async function readFromCloud(cloud: HerCloudStore, file: string): Promise<HerProfileReadResult | null> {
  try {
    const loaded = await cloud.load();

    if (loaded.status === 'empty') {
      return null;
    }

    const parsed = herProfileSchema.safeParse(loaded.raw);

    if (!parsed.success) {
      return {
        profile: defaultHerProfile(),
        source: 'default',
        problem: {
          kind: 'invalid',
          message: `${cloud.label} 里的内容校验不过（${summarizeIssues(parsed.error)}），现在用的是默认内容；本地文件没有被改动。`,
          file,
        },
      };
    }

    return { profile: withTimelineOrder(parsed.data), source: 'cloud', problem: null };
  } catch (error) {
    const message =
      error instanceof HerCloudError
        ? error.message
        : `云端读取失败（${error instanceof Error ? error.message : '未知错误'}），已降级到本地文件。`;

    return {
      profile: defaultHerProfile(),
      source: 'default',
      problem: { kind: 'cloud', message, file },
    };
  }
}

/** `iso` 降序、`null` 排最后；`iso` 相同时保持原相对顺序（`Array#sort` 稳定）。 */
function withTimelineOrder(profile: HerProfile): HerProfile {
  return { ...profile, timeline: [...profile.timeline].sort(compareEvents) };
}

function compareEvents(left: HerEvent, right: HerEvent): number {
  if (left.iso === right.iso) {
    return 0;
  }

  if (left.iso === null) {
    return 1;
  }

  if (right.iso === null) {
    return -1;
  }

  // 固定宽度 ISO 日期，直接比字符串即可，不引 locale 规则。
  return left.iso < right.iso ? 1 : -1;
}

function summarizeIssues(error: {
  readonly issues: readonly { readonly path?: readonly PropertyKey[]; readonly message: string }[];
}): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path?.map(String).join('.') || '(根)'}：${issue.message}`)
    .join('；');
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}
