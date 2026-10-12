'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { originalHerImage } from './her-image-url';
import type { HerGalleryGroup, HerGalleryPhoto } from './her-types';

/**
 * 图片加载失败时的兜底：换回原图再试一次。
 *
 * 为什么需要它（2026-10-12 实测）：Supabase 的按需缩放会拒绝超大分辨率的图
 * （6144×8192 那张返回 `400 The source image resolution is too large to process`），
 * 而它的**原图是能正常显示的**。没有这层兜底，那一张就会变成裂图。
 *
 * 只回退一次（`dataset.fallback` 打标），避免原图也失败时无限重试刷请求。
 */
function applyThumbFallback(event: React.SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;

  if (img.dataset.fallback === '1') {
    return;
  }

  img.dataset.fallback = '1';
  img.src = originalHerImage(img.src);
}

/**
 * 照片墙 = 网格 + 原位放大查看器，两页里唯一的客户端组件。
 *
 * 为什么网格和遮罩写在同一个文件里：网格里每个按钮的点击与遮罩共享同一份状态
 * （「现在打开第几张」+「关了以后焦点回到哪个按钮」），拆成两个组件只能把状态
 * 提升到更外层，反而把更大的范围拖进客户端包。
 *
 * 传进来的只有 `groups`（见 `her-data.ts` 算好的纯字符串），`herProfile` 的内容
 * 不会进入客户端 bundle。
 *
 * 交互全部手写，没装任何弹窗/lightbox 库：
 * - Esc、点遮罩关闭；
 * - ← → 在**本页全部照片**之间切换；
 * - 打开时锁 body 滚动、Tab 焦点锁在查看器内；
 * - 关闭后焦点回到当初点开的那张缩略图；
 * - 淡入是 CSS transition，`prefers-reduced-motion` 下直接不淡入。
 */
export function HerPhotoViewer({ groups }: { groups: readonly HerGalleryGroup[] }) {
  /** 把分组摊平成一条顺序（与页面从上到下一致），并记下每张锚点对应的下标。 */
  const flat = useMemo(() => {
    const photos: HerGalleryPhoto[] = [];
    const indexById = new Map<string, number>();

    for (const group of groups) {
      for (const photo of group.photos) {
        indexById.set(photo.id, photos.length);
        photos.push(photo);
      }
    }

    return { photos, indexById };
  }, [groups]);

  const total = flat.photos.length;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const isOpen = openIndex !== null;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 关闭后要把焦点送回去的那个按钮。 */
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
  }, []);

  const openAt = useCallback((index: number, trigger: HTMLButtonElement) => {
    openerRef.current = trigger;
    setOpenIndex(index);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null || total === 0) {
          return current;
        }

        return (current + delta + total) % total;
      });
    },
    [total],
  );

  /** Tab 循环：焦点要么在首尾之间打转，要么被拉回查看器内。 */
  const trapTab = useCallback((event: KeyboardEvent) => {
    const panel = panelRef.current;

    if (panel === null) {
      return;
    }

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])'));

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && panel.contains(active);

    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }

      return;
    }

    if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // 打开期间：锁 body 滚动、把焦点送进查看器、下一帧淡入。清理时原样恢复。
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => setShown(true));
    closeButtonRef.current?.focus();

    return () => {
      cancelAnimationFrame(frame);
      setShown(false);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // 关闭后焦点回到原来那张缩略图；首次挂载时 openerRef 还是空的，什么也不做。
  useEffect(() => {
    if (isOpen) {
      return;
    }

    openerRef.current?.focus();
  }, [isOpen]);

  // 挂在 document 上：焦点在查看器内任何位置（含刚打开的那一帧）都能收到键。
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
        return;
      }

      if (event.key === 'Tab') {
        trapTab(event);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close, step, trapTab]);

  const current = openIndex === null ? null : (flat.photos[openIndex] ?? null);
  // 未归属事件的照片没有日期也没有事件名，这一行就不渲染，不留空行。
  const currentEventLine = current === null ? '' : joinParts([current.eventDate, current.eventTitle]);

  return (
    <>
      <div className="space-y-10">
        {groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`her-group-${group.key}`}
            className="border-t border-rule pt-6 dark:border-night-rule"
          >
            <h2
              id={`her-group-${group.key}`}
              className="mb-5 font-serif text-lg font-bold text-ink dark:text-cream"
            >
              {group.headingHref === null ? (
                // 不是时间线上的事件（例如「还没归到事件里」那组）：标题不可点，
                // 也不给「回时间线」的可访问提示——链回时间线是错的。
                <>
                  {group.heading}
                  <span className="ml-3 font-sans text-sm font-normal text-ink-soft dark:text-cream-soft">
                    {group.headingDate}
                  </span>
                </>
              ) : (
                <Link
                  href={group.headingHref}
                  className="underline-offset-4 hover:text-rust dark:hover:text-rust-soft"
                >
                  {group.heading}
                  <span className="ml-3 font-sans text-sm font-normal text-ink-soft dark:text-cream-soft">
                    {group.headingDate}
                  </span>
                  <span className="sr-only"> → 回时间线</span>
                </Link>
              )}
            </h2>

            {group.photos.length === 0 ? (
              <p className="rounded-sm border border-dashed border-rule bg-paper-soft px-6 py-10 text-center text-sm text-ink-soft dark:border-night-rule dark:bg-night-soft dark:text-cream-soft">
                等你的照片
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.photos.map((photo) => {
                  const index = flat.indexById.get(photo.id) ?? 0;
                  const caption = joinParts([photo.day, photo.note]);

                  return (
                    <li key={photo.id} id={photo.id} className="scroll-mt-6">
                      <figure>
                        <button
                          type="button"
                          onClick={(event) => openAt(index, event.currentTarget)}
                          aria-label={`放大查看：${photo.alt}`}
                          className="block w-full cursor-zoom-in"
                        >
                          <span className="block aspect-[4/3] w-full overflow-hidden rounded-sm border border-rule bg-paper-soft dark:border-night-rule dark:bg-night-soft">
                            {/* eslint-disable-next-line @next/next/no-img-element -- 本地 public/ 图片，按 docs/her-page-roadmap.md §3.5 不走 next/image */}
                            <img
                              src={photo.thumbSrc}
                              alt=""
                              loading="lazy"
                              onError={applyThumbFallback}
                              className="h-full w-full object-cover"
                            />
                          </span>
                        </button>
                        {caption.length === 0 ? null : (
                          <figcaption className="mt-2 text-xs text-ink-soft dark:text-cream-soft">
                            {caption}
                          </figcaption>
                        )}
                      </figure>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {current === null || openIndex === null ? null : (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-night/95 p-4 transition-opacity duration-200 motion-reduce:transition-none ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="照片查看器"
            className="flex w-full max-w-3xl flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-4 text-xs text-cream-soft">
              <p>
                {openIndex + 1} / {total}
              </p>
              <div className="flex items-center gap-3">
                <p className="hidden sm:block">Esc / 点遮罩关闭</p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="关闭照片查看器"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-soft/60 text-lg leading-none text-cream transition-colors hover:border-rust-soft hover:text-rust-soft"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="上一张照片"
                className="inline-flex h-10 w-8 shrink-0 items-center justify-center text-2xl leading-none text-cream-soft transition-colors hover:text-rust-soft"
              >
                ‹
              </button>

              <div className="flex min-w-0 flex-1 justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- 本地 public/ 图片，按 docs/her-page-roadmap.md §3.5 不走 next/image */}
                <img
                  src={current.src}
                  alt={current.alt}
                  onError={applyThumbFallback}
                  className="max-h-[70vh] w-auto max-w-full rounded-sm object-contain"
                />
              </div>

              <button
                type="button"
                onClick={() => step(1)}
                aria-label="下一张照片"
                className="inline-flex h-10 w-8 shrink-0 items-center justify-center text-2xl leading-none text-cream-soft transition-colors hover:text-rust-soft"
              >
                ›
              </button>
            </div>

            <div className="px-10 text-xs text-cream-soft">
              {currentEventLine === '' ? null : (
                <p className="text-sm text-cream">{currentEventLine}</p>
              )}
              {current.note === null ? null : <p className="mt-1">{current.note}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 用 ` · ` 拼可见文案，空段丢掉。 */
function joinParts(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join(' · ');
}
