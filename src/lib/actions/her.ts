'use server';

import { revalidatePath } from 'next/cache';

import { herProfileSchema } from '@/domain/her-schemas';
import { requireAdmin } from '@/lib/auth/server';
import { HerCloudError } from '@/lib/content/her-cloud';
import { saveHerProfile } from '@/lib/content/her-source';

/**
 * 「她」三页内容的保存入口。
 *
 * 数据流：后台表单把整份 HerProfile 序列化成 JSON 塞进 FormData 的 `payload` 字段
 * → 这里 `requireAdmin()` → `herProfileSchema` 校验（为了给出中文原因）
 * → 引用完整性检查 → `saveHerProfile()`（这一层负责归一化 timeline 顺序 + 原子写 `data/her.json`）
 * → 三个公开页 `revalidatePath`。
 *
 * 三条边界：
 * - 只写 `data/her.json`，从不碰 `src/content/her.ts`（那份是回退用的默认内容）；
 * - 校验不过就整份拒绝，不写半份数据；
 * - 写盘一律走内容层的 `saveHerProfile()`，不在这里自己 `writeObject` ——
 *   否则会绕开它对 timeline 的归一化（iso 降序、null 排最后），读写两条路就会不一致。
 */

export type SaveHerProfileResult = { ok: true } | { ok: false; error: string };

const PUBLIC_PATHS = ['/her', '/her/photos', '/her/letter'] as const;
const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function saveHerProfileAction(formData: FormData): Promise<SaveHerProfileResult> {
  await requireAdmin();

  const raw = formData.get('payload');

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: '没有收到要保存的内容，请刷新页面后重试。' };
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, error: '表单内容不是合法 JSON（页面可能已经过期），请刷新页面后重试。' };
  }

  const parsed = herProfileSchema.safeParse(decoded);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '（顶层）'}：${issue.message}`)
      .join('；');

    return { ok: false, error: `内容没有通过校验：${detail}` };
  }

  const profile = parsed.data;
  const referenceError = checkReferences(profile);

  if (referenceError !== null) {
    return { ok: false, error: referenceError };
  }

  try {
    await saveHerProfile(profile);
  } catch (error) {
    // 云端问题单独说人话：最常见的是「表还没建」（迁移没跑），
    // 这时把「去哪儿跑哪份 SQL」直接写进提示，而不是把 PostgREST 的英文丢给用户。
    if (error instanceof HerCloudError) {
      return { ok: false, error: error.message };
    }

    return { ok: false, error: error instanceof Error ? error.message : '保存内容失败。' };
  }

  // 三个公开页是 force-dynamic，本来就不会吃到旧缓存；这里再显式失效一次，
  // 将来若有人给它们加缓存，保存后仍然立刻可见。
  for (const path of PUBLIC_PATHS) {
    revalidatePath(path);
  }

  return { ok: true };
}

/**
 * 引用完整性：这些规则 zod 表达不了，但破了会让公开页静默丢内容。
 * 对应 `src/content/her.ts` 顶部写的不变量，以及 `tests/her-content.test.ts` 的断言。
 */
function checkReferences(profile: {
  readonly timeline: readonly {
    readonly id: string;
    readonly iso: string | null;
    readonly title: string;
    readonly photos?: readonly string[];
  }[];
  readonly photos: readonly { readonly file: string }[];
}): string | null {
  const seen = new Set<string>();
  const seenIso = new Set<string>();

  for (const event of profile.timeline) {
    if (!EVENT_ID_PATTERN.test(event.id)) {
      return `大事记「${event.title || '（未命名）'}」的锚点 id「${event.id}」不合法：只能用小写英文字母、数字和短横（例如 first-meeting）。`;
    }

    if (seen.has(event.id)) {
      return `大事记里有两条事件用了同一个锚点 id「${event.id}」，请改成不同的。`;
    }

    seen.add(event.id);

    // 事件的 iso 是照片反查归属的钥匙（见 eventOfPhoto），重复会让反查指错事件。
    if (event.iso !== null && event.iso !== '') {
      if (seenIso.has(event.iso)) {
        return `有两条事件的精确日期都是 ${event.iso}，照片按日期反查会指错事件，请改成不同的日期。`;
      }

      seenIso.add(event.iso);
    }
  }

  const referenced = new Set(profile.timeline.flatMap((event) => event.photos ?? []));
  const orphan = profile.photos.filter((photo) => !referenced.has(photo.file));

  // 只在「已经有事件可以挂」的时候拦；一条事件都还没建的时候允许先存照片，
  // 否则新用户上传完第一张图会因为无处归属而整份存不下来。
  //
  // 归属的判据是**事件自己的 `photos` 列表**，不是 `eventIso`：
  // 事件没有精确日期（页面显示「待填」）时它推导不出 iso，但照片明明挂在这条事件上——
  // 早先这里只认 eventIso，导致「挂到一条没有日期的待填事件」会被误判成没有归属而整份存不下来。
  //
  // 口径说明：`src/domain/her-schemas.ts` 刻意不在 zod 里要求「每张照片都必须被事件引用」
  // （怕刚上传的照片被整份校验失败吞掉）。这里补这一条是因为公开页的照片墙按事件分组，
  // 没有归属的照片会被静默丢掉（计数行仍会把它算进去）——拦在写盘前比让它消失好。
  if (profile.timeline.length > 0 && orphan.length > 0) {
    return `这些照片还没有归到任何事件：${orphan.map((photo) => photo.file).join('、')}。请在「照片」里给它们选一个所属事件，否则照片墙上不会显示它们。`;
  }

  return null;
}
