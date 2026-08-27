'use client';

import { useEffect, useRef, useState } from 'react';

export function ShareActions({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // navigator 只在客户端存在：挂载后异步判定，避免 SSR/水合不一致。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCanShare(typeof navigator.share === 'function');
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {canShare ? (
        <button
          type="button"
          onClick={() => {
            navigator.share({ title, url }).catch(() => undefined);
          }}
          className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          分享
        </button>
      ) : (
        <button
          type="button"
          onClick={copyLink}
          className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
        >
          复制链接
        </button>
      )}
      <span aria-live="polite" className="text-xs text-ink-soft dark:text-cream-soft">
        {copied ? '已复制' : ''}
      </span>
    </div>
  );
}
