'use client';

import { useState } from 'react';

/**
 * 列表页搜索框：GET 提交到当前路径，配合 ?q= 查询参数做服务端过滤。
 */
export function SearchForm({ defaultValue = '', placeholder }: { defaultValue?: string; placeholder: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <form action="" method="get" role="search" className="flex max-w-md items-stretch gap-2">
      <label htmlFor="search-q" className="sr-only">
        搜索标题或摘要
      </label>
      <input
        id="search-q"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 dark:border-night-rule dark:bg-night dark:text-cream dark:placeholder:text-cream-soft/60"
      />
      <button
        type="submit"
        className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
      >
        搜索
      </button>
    </form>
  );
}
