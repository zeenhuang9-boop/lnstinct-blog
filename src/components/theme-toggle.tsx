'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lnstinct-theme';
const CHANGE_EVENT = 'lnstinct-theme-change';

let cached: boolean | null = null;

function readTheme(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (cached !== null) {
    return cached;
  }

  let stored: string | null = null;

  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  // 默认始终为暖色书本纸页（浅色）；只有用户明确选择过“夜”才进入暗色。
  const value = stored === 'dark';

  cached = value;
  return value;
}

function subscribeTheme(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function applyTheme(next: boolean): void {
  cached = next;
  document.documentElement.classList.toggle('dark', next);

  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  } catch {
    // 隐私模式等场景下写入失败不影响本次会话的主题切换。
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 供根布局内联脚本与测试复用：首帧前应用持久化主题，避免闪烁。 */
export function applyStoredTheme(): void {
  applyTheme(readTheme());
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, readTheme, () => false);

  return (
    <button
      type="button"
      onClick={() => applyTheme(!dark)}
      aria-label="切换主题"
      aria-pressed={dark}
      className="inline-flex h-9 w-9 items-center justify-center border border-rule text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft"
    >
      {dark ? '夜' : '昼'}
    </button>
  );
}
