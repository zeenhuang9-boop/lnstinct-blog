/**
 * 照片锚点 id —— 「时间线缩略图 ↔ 照片墙那一张」之间唯一的一条链子。
 *
 * 规则由任务契约固定：`'photo-' + 文件名.replace(/\./g, '-')`。
 * 例：`2026-10-12-01.jpg` → `photo-2026-10-12-01-jpg`（点号换成短横，扩展名那一节也一起变），于是
 * `/her/photos#photo-2026-10-12-01-jpg` 能把人送到照片墙上那一张。
 *
 * 纯字符串运算，没有副作用：服务器组件（时间线、最近的照片）与客户端查看器
 * 引的是同一份规则，不允许出现第二种写法。
 */
export function photoAnchorId(file: string): string {
  return `photo-${file.replace(/\./g, '-')}`;
}
