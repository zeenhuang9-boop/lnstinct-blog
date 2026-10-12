import { access } from 'node:fs/promises';

import { herProfile, type HerEvent, type HerProfile } from '@/content/her';
import { herProfileSchema } from '@/domain/her-schemas';
import { dataFilePath, readObject, writeObject } from '@/lib/store/files';

/**
 * 「她」三页的内容来源。
 *
 * 读取顺序：`data/her.json`（后台改过的内容）→ zod 校验 → 通过就用；
 * 文件不存在 / 坏掉 / 校验不过 → 回退到 `src/content/her.ts` 的默认内容，原因放在 `problem` 里。
 *
 * 四条边界：
 * - **不静默覆盖**：坏文件原样留在磁盘上，这里只读不写；要覆盖只能由后台保存动作显式写入。
 * - **不做进程内缓存**：与 `src/lib/store/files.ts` 一致（Next dev 下模块可能被重新求值、多实例并存，
 *   缓存会导致「刚保存完，页面还是旧内容」）。本地 JSON 很小，每次直接读盘。
 * - **顺序的权威在这里**：`timeline` 一律归一化成「`iso` 降序、`null` 排最后」，页面按数组顺序渲染、
 *   不再自己排序（读写两条路都过同一个函数，手改过的文件也会被纠正）。
 * - **Supabase 未接入**：帖子/项目走 `getContentDataSource()`，配了 Supabase 就上云；
 *   「她」的内容目前**只有本地文件这一条路**，配了 Supabase 也不会切云端（没有对应的表与仓储）。
 *   将来要上云，照 `src/lib/content/supabase-repository.ts` 另补一个实现，不要在这里假装已支持。
 */

/** `data/her.json` 的文件名（不含扩展名）。 */
export const HER_DATA_NAME = 'her';

export type HerProfileProblemKind = 'missing' | 'unreadable' | 'invalid';

export type HerProfileProblem = {
  readonly kind: HerProfileProblemKind;
  /** 给人看的一句话原因（后台可以直接显示） */
  readonly message: string;
  /** 出问题的文件绝对路径（missing 时是它本该在的位置），用于保留现场与后台提示 */
  readonly file: string;
};

export type HerProfileSource = 'file' | 'default';

export type HerProfileReadResult = {
  readonly profile: HerProfile;
  readonly source: HerProfileSource;
  /** 正常从 `data/her.json` 读到就是 null */
  readonly problem: HerProfileProblem | null;
};

/** 默认内容（`src/content/her.ts`）：首次保存之前、以及文件坏掉时的回退。 */
export function defaultHerProfile(): HerProfile {
  return herProfile;
}

/**
 * 读当前内容，并说明它是从哪来的。
 * 页面只需要内容时用 `getHerProfile()`；后台要提示「文件坏了、现在显示的是默认内容」时用这个。
 */
export async function readHerProfile(): Promise<HerProfileReadResult> {
  const file = dataFilePath(HER_DATA_NAME);

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
export async function getHerProfile(): Promise<HerProfile> {
  const { profile } = await readHerProfile();

  return profile;
}

/**
 * 后台保存：**先过 zod 再原子写**，校验不过直接抛错、不落盘（避免写坏文件让页面回退成默认内容）。
 * 写盘前把 `timeline` 归一化成「`iso` 降序、`null` 排最后」。
 */
export async function saveHerProfile(input: unknown): Promise<HerProfile> {
  const parsed = herProfileSchema.parse(input);
  const profile: HerProfile = withTimelineOrder(parsed);

  await writeObject(HER_DATA_NAME, profile);

  return profile;
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
