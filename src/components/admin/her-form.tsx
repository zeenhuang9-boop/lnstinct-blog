'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { HerProfile } from '@/content/her';
import { saveHerProfileAction } from '@/lib/actions/her';
import { uploadMediaAction } from '@/lib/actions/media';
import { todayInShanghai } from '@/lib/date';

/**
 * 「她」的内容编辑表单。
 *
 * 覆盖四块：基本（称呼/生日/纪念日/建页日）、大事记、照片、信。
 * 整份内容在本地状态里是一个 draft，保存时序列化成一份 HerProfile 交给 Server Action
 * —— 校验、写盘、revalidate 都在 `src/lib/actions/her.ts`，这里不做第二套规则。
 *
 * 三处刻意的设计：
 * 1. **照片的「归属事件」只选一次**：绑定存在照片行上（按事件 id 选），保存时同时派生
 *    `photos[].eventIso` 与 `timeline[].photos`。让用户分两处维护同一个绑定必然漂移，
 *    而内容层的契约测试会直接拒绝漂移的数据。
 * 2. **有精确日期时，显示用日期由 `iso` 生成**（`2026 · 10 · 12`），不让两处各写一遍；
 *    只有「没有精确日期」时那格才可手写。
 * 3. 本地不留一份校验规则：出错一律由 Server Action 返回中文原因，这里只负责显示。
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type TimelineDraft = {
  /** 行身份：只在运行期唯一（照片靠它认事件）；**不要**用它拼 DOM id —— 会重名。 */
  readonly key: string;
  id: string;
  date: string;
  iso: string;
  title: string;
  note: string;
};

type PhotoDraft = {
  /** 行身份：同上，不拼 DOM id。 */
  readonly key: string;
  file: string;
  src: string;
  caption: string;
  /** 所属事件 = TimelineDraft.key；'' 表示还没归到事件。 */
  eventKey: string;
};

type LetterDraft = {
  salutation: string;
  paragraphs: string[];
  quote: string;
  signature: string;
};

type ProfileDraft = {
  displayName: string;
  tagline: string;
  birthdayMonth: string;
  birthdayDay: string;
  since: string;
  pageBuiltOn: string;
  timeline: TimelineDraft[];
  photos: PhotoDraft[];
  letter: LetterDraft;
};

const inputClass =
  'w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 dark:border-night-rule dark:bg-night dark:text-cream dark:placeholder:text-cream-soft/60';
const labelClass = 'mb-1 block text-xs text-ink-soft dark:text-cream-soft';
const hintClass = 'mt-1 text-xs text-ink-soft/80 dark:text-cream-soft/80';
const sectionTitleClass = 'font-serif text-xl font-bold text-ink dark:text-cream';
const sectionHintClass = 'mt-1 text-sm text-ink-soft dark:text-cream-soft';
const smallButtonClass =
  'border border-rule px-3 py-1 text-xs text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft';
const addButtonClass =
  'border border-rust px-3 py-1.5 text-xs text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night';

/*
 * 这里曾经有一个模块级自增计数器 `nextKey()` 给草稿行生成 key。
 * 它造成过两个真实缺陷，都不要再引入：
 * 1. key 被拼进表单字段 id → SSR 与 hydration 编号不同 → React 报 hydration 属性不匹配；
 * 2. 照片靠 `photo.eventKey === event.key` 认归属，而计数器每次渲染都往前跑 ——
 *    保存时算出的 key 与照片记下的 key 不同源，照片的归属会被算成空，界面上看着像"丢了事件"。
 * 现在的规则：
 * - **行身份（key）**：事件用它的 id、照片用文件名、新增行用「时间戳+随机尾缀」，只在运行期唯一；
 * - **DOM id**：一律按渲染下标派生（`her-event-title-${index}`），保证同一份 DOM 里绝不重名；
 * - 两者不能混用 —— 混用就会出现「改一行改两行、删一行删两行」这类静默数据错乱。
 */

/** 今天（Asia/Shanghai）的 `YYYY-MM-DD`，用来挡住「建页日填未来」这类会显示负数的输入。 */
function todayIso(): string {
  const today = todayInShanghai();

  return `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
}

/** `2026-10-12` → `2026 · 10 · 12`（与内容文件里 date 的写法一致）。 */function isoToDisplay(iso: string): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  return matched === null ? iso : `${matched[1]} · ${matched[2]} · ${matched[3]}`;
}

/** 照片当前挂在哪个事件上：先按事件的 photos 列表认，再按 eventIso 反查（同 eventOfPhoto 的顺序）。 */
function ownerEventKey(
  profile: HerProfile,
  file: string,
  eventIso: string | null | undefined,
  keyByEventId: ReadonlyMap<string, string>,
): string {
  const byList = profile.timeline.find((event) => (event.photos ?? []).includes(file));

  if (byList !== undefined) {
    return keyByEventId.get(byList.id) ?? '';
  }

  if (typeof eventIso === 'string') {
    const byIso = profile.timeline.find((event) => event.iso === eventIso);

    if (byIso !== undefined) {
      return keyByEventId.get(byIso.id) ?? '';
    }
  }

  return '';
}

function toDraft(profile: HerProfile): ProfileDraft {
  const timeline: TimelineDraft[] = profile.timeline.map((event) => ({
    // 行身份由数据派生（事件 id 唯一），照片靠它认事件。
    // 历史教训：曾经用模块级自增计数器，导致保存时身份不同源、照片丢归属。
    key: event.id,
    id: event.id,
    date: event.date ?? '',
    iso: event.iso ?? '',
    title: event.title,
    note: event.note ?? '',
  }));

  const keyByEventId = new Map(timeline.map((event) => [event.id, event.key]));

  const photos: PhotoDraft[] = profile.photos.map((photo) => ({
    // 照片的行身份用文件名（上传后即确定且唯一）；还没上传的行由 addPhoto 生成唯一值。
    key: photo.file,
    file: photo.file,
    src: photo.src ?? '',
    caption: photo.caption ?? '',
    eventKey: ownerEventKey(profile, photo.file, photo.eventIso, keyByEventId),
  }));

  return {
    displayName: profile.displayName,
    tagline: profile.tagline,
    birthdayMonth: String(profile.birthday.month),
    birthdayDay: String(profile.birthday.day),
    since: profile.since ?? '',
    pageBuiltOn: profile.pageBuiltOn,
    timeline,
    photos,
    letter: {
      salutation: profile.letter.salutation,
      paragraphs: [...profile.letter.paragraphs],
      quote: profile.letter.quote ?? '',
      signature: profile.letter.signature ?? '',
    },
  };
}

/**
 * draft → 写盘用的 HerProfile。
 * 顶层形状（含 `slug: 'her'`）必须与 `herProfileSchema` 完全一致，多一个字段都会被 .strict() 拒掉。
 */
function buildPayload(draft: ProfileDraft) {
  const timeline = draft.timeline.map((event) => {
    const iso = event.iso.trim();
    const note = event.note.trim();
    const photos = draft.photos
      .filter((photo) => photo.eventKey === event.key && photo.file.trim() !== '')
      .map((photo) => photo.file.trim());

    return {
      id: event.id.trim(),
      // 有精确日期 → 显示文案由 iso 生成，不让 date 与 iso 两处各说一套；
      // 没有精确日期 → 用那格手写的说法（也可以是空，即「待填」）。
      date: iso === '' ? (event.date.trim() === '' ? null : event.date.trim()) : isoToDisplay(iso),
      iso: iso === '' ? null : iso,
      title: event.title.trim(),
      photos,
      ...(note === '' ? {} : { note }),
    };
  });

  const photos = draft.photos
    .filter((photo) => photo.file.trim() !== '')
    .map((photo) => {
      const src = photo.src.trim();
      const caption = photo.caption.trim();
      // 每次保存都把全部 eventIso 重新派生一遍（而不是只改被编辑的那张）：
      // 否则用户改了事件日期以后，老照片会留着旧 iso，反查就指错事件。
      const owner = draft.timeline.find(
        (event) => event.key === photo.eventKey && event.iso.trim() !== '',
      );

      return {
        file: photo.file.trim(),
        ...(src === '' ? {} : { src }),
        ...(caption === '' ? {} : { caption }),
        eventIso: owner === undefined ? null : owner.iso.trim(),
      };
    });

  const quote = draft.letter.quote.trim();
  const signature = draft.letter.signature.trim();

  return {
    slug: 'her' as const,
    displayName: draft.displayName.trim(),
    tagline: draft.tagline.trim(),
    birthday: {
      month: Number(draft.birthdayMonth),
      day: Number(draft.birthdayDay),
    },
    since: draft.since.trim() === '' ? null : draft.since.trim(),
    pageBuiltOn: draft.pageBuiltOn.trim(),
    // Hero 上的年份与建页日必须一致（内容文件的不变量），所以由建页日推出来，不收第二遍输入。
    heroYear: draft.pageBuiltOn.trim().slice(0, 4),
    timeline,
    photos,
    letter: {
      salutation: draft.letter.salutation.trim(),
      paragraphs: draft.letter.paragraphs.map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph !== ''),
      ...(quote === '' ? {} : { quote }),
      ...(signature === '' ? {} : { signature }),
    },
  };
}

/**
 * 提交前的快速体检：zod 的报错信息是英文的、还会带 `timeline.0.title` 这种路径，
 * 常见的手误在这里先用中文说清楚。**这不是校验层**——真正的判定仍在
 * `herProfileSchema` 与 `src/lib/actions/her.ts` 的引用完整性检查里。
 */
function describeDraftProblem(draft: ProfileDraft): string | null {
  if (draft.displayName.trim() === '') {
    return '「称呼」不能为空。';
  }

  if (draft.tagline.trim() === '') {
    return '「副标题」不能为空，主页标题下面那句要用它。';
  }

  if (draft.pageBuiltOn.trim() === '') {
    return '「建页日」要选一个真实日期，Hero 上的年份由它推出来。';
  }

  // 建页日在未来时「站在这页上的时间」会算成负数（daysTogether 刻意不夹到 0），
  // 页面上就会显示「-45 天」。与其让公开页出现这种数字，不如在保存前说清楚。
  if (draft.pageBuiltOn.trim() > todayIso()) {
    return '「建页日」不能是未来的日期 —— 否则主页第二张卡会显示负数天数。';
  }

  if (draft.letter.salutation.trim() === '') {
    return '信的开头称呼不能为空（例如「小宇：」）。';
  }

  const emptyTitle = draft.timeline.findIndex((event) => event.title.trim() === '');

  if (emptyTitle >= 0) {
    return `大事记第 ${emptyTitle + 1} 条还没有写事件名。`;
  }

  const orphan = draft.photos.filter(
    (photo) => photo.file.trim() !== '' && photo.eventKey === '' && draft.timeline.length > 0,
  );

  if (orphan.length > 0) {
    return `还有 ${orphan.length} 张照片没选「所属事件」，照片墙上不会显示它们。`;
  }

  return null;
}

export function HerForm({ profile, photoDir }: { profile: HerProfile; photoDir: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(profile));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  function patchDraft(patch: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function patchTimeline(key: string, patch: Partial<TimelineDraft>) {
    setDraft((current) => ({
      ...current,
      timeline: current.timeline.map((event) => (event.key === key ? { ...event, ...patch } : event)),
    }));
  }

  function patchPhoto(key: string, patch: Partial<PhotoDraft>) {
    setDraft((current) => ({
      ...current,
      photos: current.photos.map((photo) => (photo.key === key ? { ...photo, ...patch } : photo)),
    }));
  }

  function addEvent() {
    setDraft((current) => {
      // 新事件的内置 id 与锚点 id 都要避开已存在的（否则 schema 会整份拒绝保存）。
      let suffix = current.timeline.length + 1;

      while (current.timeline.some((event) => event.id === `event-${suffix}`)) {
        suffix += 1;
      }

      // 行身份必须**运行期唯一**：曾经用「数组长度」派生，导致「加一行→删一行→再加一行」
      // 出现重名 —— 改一行会改两行、删一行会删两行，甚至能静默删掉已保存的照片。
      // 时间戳 + 随机尾缀，和已有身份（事件 id / 文件名 / 同前缀的新行）都不可能撞。
      const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      return {
        ...current,
        timeline: [
          ...current.timeline,
          {
            key: `new-${unique}`,
            id: `event-${suffix}`,
            date: '',
            iso: '',
            title: '',
            note: '',
          },
        ],
      };
    });
  }

  function removeEvent(key: string) {
    setDraft((current) => ({
      ...current,
      // 事件没了，挂在它上面的照片要退回「未归属」，否则保存时会被引用完整性检查拦下。
      timeline: current.timeline.filter((event) => event.key !== key),
      photos: current.photos.map((photo) =>
        photo.eventKey === key ? { ...photo, eventKey: '' } : photo,
      ),
    }));
  }

  function moveEvent(key: string, delta: number) {
    setDraft((current) => {
      const index = current.timeline.findIndex((event) => event.key === key);
      const target = index + delta;

      if (index < 0 || target < 0 || target >= current.timeline.length) {
        return current;
      }

      const timeline = [...current.timeline];
      const [moved] = timeline.splice(index, 1);
      timeline.splice(target, 0, moved);

      return { ...current, timeline };
    });
  }

  function addPhoto() {
    setDraft((current) => {
      // 与 addEvent 同理：行身份运行期唯一；上传成功后这一行会被换成真实文件名。
      const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      return {
        ...current,
        photos: [
          ...current.photos,
          {
            key: `slot-${unique}`,
            file: '',
            src: '',
            caption: '',
            // 默认挂到第一条事件，省得每次都要选一遍。
            eventKey: current.timeline[0]?.key ?? '',
          },
        ],
      };
    });
  }

  function removePhoto(key: string) {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.key !== key),
    }));
  }

  async function handleUpload(photoKey: string, file: File) {
    setUploadingKey(photoKey);
    setActionError(null);

    const form = new FormData();
    form.set('file', file);

    try {
      const result = await uploadMediaAction(form);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      // file 只存纯文件名（它同时是锚点 id 与去重键），完整地址存进 src；
      // photoSrc() 有 src 就用 src，没有才退回 PHOTO_DIR + file。
      const name = (result.url.split('?')[0].split('/').pop() ?? '').trim();

      if (name === '') {
        setActionError('上传成功但拿不到文件名，请换一张图重试。');
        return;
      }

      patchPhoto(photoKey, { src: result.url, file: name });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '图片上传失败。');
    } finally {
      setUploadingKey(null);
    }
  }

  async function save() {
    setSaveState('saving');
    setActionError(null);

    const problem = describeDraftProblem(draft);

    if (problem !== null) {
      setSaveState('error');
      setActionError(problem);
      return;
    }

    const form = new FormData();
    form.set('payload', JSON.stringify(buildPayload(draft)));

    const result = await saveHerProfileAction(form);

    if (!result.ok) {
      setSaveState('error');
      setActionError(result.error);
      return;
    }

    setSaveState('saved');
    router.refresh();
    // 留半秒让人看到「已保存」，再把页面带到 /her 验收。
    window.setTimeout(() => router.push('/her'), 600);
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="her-basic-title" className="space-y-4">
        <div>
          <h2 id="her-basic-title" className={sectionTitleClass}>
            基本
          </h2>
          <p className={sectionHintClass}>称呼只用昵称，别写真名——这一页将来可能被看到。</p>
        </div>

        <div>
          <label htmlFor="her-display-name" className={labelClass}>
            称呼
          </label>
          <input
            id="her-display-name"
            type="text"
            value={draft.displayName}
            onChange={(event) => patchDraft({ displayName: event.target.value })}
            placeholder="昵称占位"
            className={`${inputClass} font-serif text-lg font-bold`}
          />
        </div>

        <div>
          <label htmlFor="her-tagline" className={labelClass}>
            副标题
          </label>
          <textarea
            id="her-tagline"
            value={draft.tagline}
            onChange={(event) => patchDraft({ tagline: event.target.value })}
            rows={2}
            placeholder="主页标题下面那一句话"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="her-birthday-month" className={labelClass}>
              生日 · 月
            </label>
            <input
              id="her-birthday-month"
              type="number"
              min={1}
              max={12}
              value={draft.birthdayMonth}
              onChange={(event) => patchDraft({ birthdayMonth: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="her-birthday-day" className={labelClass}>
              生日 · 日
            </label>
            <input
              id="her-birthday-day"
              type="number"
              min={1}
              max={31}
              value={draft.birthdayDay}
              onChange={(event) => patchDraft({ birthdayDay: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="her-since" className={labelClass}>
              在一起纪念日（可空）
            </label>
            <input
              id="her-since"
              type="date"
              value={draft.since}
              onChange={(event) => patchDraft({ since: event.target.value })}
              className={inputClass}
            />
            <p className={hintClass}>留空 = 主页显示「待填」，不会拿 0 冒充。</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="her-built-on" className={labelClass}>
              建页日
            </label>
            <input
              id="her-built-on"
              type="date"
              value={draft.pageBuiltOn}
              onChange={(event) => patchDraft({ pageBuiltOn: event.target.value })}
              className={inputClass}
            />
            <p className={hintClass}>Hero 上的年份与「站在这页上的时间」都按这一天算。</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="her-timeline-title" className="space-y-4 border-t border-rule pt-8 dark:border-night-rule">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="her-timeline-title" className={sectionTitleClass}>
              大事记
            </h2>
            <p className={sectionHintClass}>
              从上到下的顺序就是页面上的顺序。有精确日期的事件保存后会按日期倒序自动排好，
              没填日期的几条可以在这里自由调。
            </p>
          </div>
          <button type="button" onClick={addEvent} className={addButtonClass}>
            + 加一条
          </button>
        </div>

        {draft.timeline.length === 0 ? (
          <p className="border border-dashed border-rule px-4 py-8 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
            还没有事件。加一条，主页的时间线才有内容。
          </p>
        ) : null}

        <ul className="space-y-4">
          {draft.timeline.map((event, index) => {
            const attached = draft.photos.filter(
              (photo) => photo.eventKey === event.key && photo.file !== '',
            );

            return (
              <li key={event.key} className="space-y-3 border border-rule p-4 dark:border-night-rule">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink-soft dark:text-cream-soft">
                    第 {index + 1} 条
                    {attached.length === 0 ? (
                      <span> · 还没有照片，主页会画虚线空位</span>
                    ) : (
                      <span> · 已挂 {attached.length} 张照片</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveEvent(event.key, -1)}
                      disabled={index === 0}
                      className={`${smallButtonClass} disabled:opacity-40`}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEvent(event.key, 1)}
                      disabled={index === draft.timeline.length - 1}
                      className={`${smallButtonClass} disabled:opacity-40`}
                    >
                      下移
                    </button>
                    <button type="button" onClick={() => removeEvent(event.key)} className={smallButtonClass}>
                      删除
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`her-event-title-${index}`} className={labelClass}>
                      事件名
                    </label>
                    <input
                      id={`her-event-title-${index}`}
                      type="text"
                      value={event.title}
                      onChange={(input) => patchTimeline(event.key, { title: input.target.value })}
                      placeholder="第一次见面"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`her-event-id-${index}`} className={labelClass}>
                      锚点 id
                    </label>
                    <input
                      id={`her-event-id-${index}`}
                      type="text"
                      value={event.id}
                      onChange={(input) => patchTimeline(event.key, { id: input.target.value })}
                      placeholder="first-meeting"
                      className={`${inputClass} font-mono text-xs`}
                    />
                    <p className={hintClass}>照片墙点事件名回到这一条时用的锚点，只用小写字母、数字和短横。</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`her-event-iso-${index}`} className={labelClass}>
                      精确日期（可空）
                    </label>
                    <input
                      id={`her-event-iso-${index}`}
                      type="date"
                      value={event.iso}
                      onChange={(input) => patchTimeline(event.key, { iso: input.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`her-event-date-${index}`} className={labelClass}>
                      显示用日期（可空）
                    </label>
                    <input
                      id={`her-event-date-${index}`}
                      type="text"
                      value={event.iso === '' ? event.date : isoToDisplay(event.iso)}
                      onChange={(input) => patchTimeline(event.key, { date: input.target.value })}
                      readOnly={event.iso !== ''}
                      placeholder="待填"
                      className={`${inputClass} ${event.iso === '' ? '' : 'opacity-60'}`}
                    />
                    <p className={hintClass}>
                      {event.iso === ''
                        ? '没有精确日期时，这里写的字会原样显示；留空就是「待填」。'
                        : '有精确日期时这格自动生成，不用手填。'}
                    </p>
                  </div>
                  <div>
                    <label htmlFor={`her-event-note-${index}`} className={labelClass}>
                      想记的一句话（可空）
                    </label>
                    <input
                      id={`her-event-note-${index}`}
                      type="text"
                      value={event.note}
                      onChange={(input) => patchTimeline(event.key, { note: input.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <p className="text-xs text-ink-soft dark:text-cream-soft">
                  挂在这个事件上的照片：
                  {attached.length === 0
                    ? '还没有。到下面的「照片」里上传并选上这条事件。'
                    : attached.map((photo) => photo.file).join('、')}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="her-photos-title" className="space-y-4 border-t border-rule pt-8 dark:border-night-rule">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="her-photos-title" className={sectionTitleClass}>
              照片
            </h2>
            <p className={sectionHintClass}>
              上传后选一个「所属事件」，否则照片墙上不会显示它。图注留空就只用事件的日期和名字。
            </p>
          </div>
          <button type="button" onClick={addPhoto} className={addButtonClass}>
            + 加一张
          </button>
        </div>

        {draft.photos.length === 0 ? (
          <p className="border border-dashed border-rule px-4 py-8 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
            还没有照片。上传第一张之后，主页会先显示最近的三张。
          </p>
        ) : null}

        <ul className="space-y-4">
          {draft.photos.map((photo, photoIndex) => (
            <li
              key={`photo-row-${photo.key}`}
              className="space-y-3 border border-rule p-4 dark:border-night-rule"
            >
              <div className="flex flex-wrap items-start gap-4">
                <span className="block h-20 w-28 shrink-0 overflow-hidden rounded-sm border border-rule bg-paper-soft dark:border-night-rule dark:bg-night-soft">
                  {photo.src === '' && photo.file === '' ? null : (
                    // eslint-disable-next-line @next/next/no-img-element -- 后台预览，本地与云端地址都要能直接显示，不走 next/image
                    <img
                      src={photo.src === '' ? `${photoDir}/${photo.file}` : photo.src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label htmlFor={`her-photo-file-${photoIndex}`} className={labelClass}>
                      图片文件
                    </label>
                    <input
                      id={`her-photo-file-${photoIndex}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';

                        if (file) {
                          void handleUpload(photo.key, file);
                        }
                      }}
                      className="block w-full text-xs text-ink-soft file:mr-3 file:border file:border-rule file:bg-paper file:px-3 file:py-1 file:text-xs file:text-ink-soft dark:text-cream-soft dark:file:border-night-rule dark:file:bg-night dark:file:text-cream-soft"
                    />
                    <p className={hintClass}>
                      {uploadingKey === photo.key
                        ? '上传中…'
                        : photo.file === ''
                          ? 'JPEG / PNG / WebP / AVIF，最大 5 MiB。'
                          : `已就位：${photo.file}`}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`her-photo-caption-${photoIndex}`} className={labelClass}>
                        图注（可空）
                      </label>
                      <input
                        id={`her-photo-caption-${photoIndex}`}
                        type="text"
                        value={photo.caption}
                        onChange={(input) => patchPhoto(photo.key, { caption: input.target.value })}
                        placeholder="那天你没看镜头"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor={`her-photo-event-${photoIndex}`} className={labelClass}>
                        所属事件
                      </label>
                      <select
                        id={`her-photo-event-${photoIndex}`}
                        value={photo.eventKey}
                        onChange={(input) => patchPhoto(photo.key, { eventKey: input.target.value })}
                        className={inputClass}
                      >
                        <option value="">（还没归到事件）</option>
                        {draft.timeline.map((event) => (
                          <option key={event.key} value={event.key}>
                            {event.title === '' ? '（未命名事件）' : event.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button type="button" onClick={() => removePhoto(photo.key)} className={smallButtonClass}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="her-letter-title" className="space-y-4 border-t border-rule pt-8 dark:border-night-rule">
        <div>
          <h2 id="her-letter-title" className={sectionTitleClass}>
            信
          </h2>
          <p className={sectionHintClass}>
            一句话一段，段与段之间自动留出站点正文的间距。正文全空时，信页显示「这封信还没写完」。
          </p>
        </div>

        <div>
          <label htmlFor="her-letter-salutation" className={labelClass}>
            开头称呼
          </label>
          <input
            id="her-letter-salutation"
            type="text"
            value={draft.letter.salutation}
            onChange={(event) =>
              patchDraft({ letter: { ...draft.letter, salutation: event.target.value } })
            }
            placeholder="小宇："
            className={inputClass}
          />
        </div>

        <div className="space-y-3">
          <span className={labelClass}>正文段落</span>

          {draft.letter.paragraphs.length === 0 ? (
            <p className="border border-dashed border-rule px-4 py-6 text-center text-sm text-ink-soft dark:border-night-rule dark:text-cream-soft">
              还没有正文。
            </p>
          ) : null}

          {draft.letter.paragraphs.map((paragraph, index) => (
            <div key={index} className="flex items-start gap-3">
              <textarea
                aria-label={`第 ${index + 1} 段`}
                value={paragraph}
                onChange={(event) => {
                  const paragraphs = [...draft.letter.paragraphs];
                  paragraphs[index] = event.target.value;
                  patchDraft({ letter: { ...draft.letter, paragraphs } });
                }}
                rows={3}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  patchDraft({
                    letter: {
                      ...draft.letter,
                      paragraphs: draft.letter.paragraphs.filter((_, position) => position !== index),
                    },
                  })
                }
                className={smallButtonClass}
              >
                删除
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              patchDraft({ letter: { ...draft.letter, paragraphs: [...draft.letter.paragraphs, ''] } })
            }
            className={addButtonClass}
          >
            + 加一段
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="her-letter-quote" className={labelClass}>
              引用（可空）
            </label>
            <input
              id="her-letter-quote"
              type="text"
              value={draft.letter.quote}
              onChange={(event) => patchDraft({ letter: { ...draft.letter, quote: event.target.value } })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="her-letter-signature" className={labelClass}>
              落款（可空）
            </label>
            <input
              id="her-letter-signature"
              type="text"
              value={draft.letter.signature}
              onChange={(event) =>
                patchDraft({ letter: { ...draft.letter, signature: event.target.value } })
              }
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {actionError === null ? null : (
        <p
          role="alert"
          className="border border-rust px-3 py-2 text-sm text-rust dark:border-rust-soft dark:text-rust-soft"
        >
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5 dark:border-night-rule">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveState === 'saving'}
          className="bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft disabled:opacity-60 dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
        >
          {saveState === 'saving' ? '保存中…' : '保存并查看 /her'}
        </button>
        <p aria-live="polite" className="text-xs text-ink-soft dark:text-cream-soft">
          {saveState === 'idle'
            ? '改完点保存，会写进 data/her.json 并打开 /her。'
            : saveState === 'saving'
              ? '正在保存…'
              : saveState === 'saved'
                ? '已保存，正在打开 /her…'
                : '保存失败，看上面的原因。'}
        </p>
      </div>
    </div>
  );
}
