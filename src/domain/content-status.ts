import type { ContentEvent, ContentStatus } from '@/domain/types';

const transitions: Record<ContentStatus, Partial<Record<ContentEvent, ContentStatus>>> = {
  draft: { publish: 'published', trash: 'trashed' },
  published: { withdraw: 'draft', trash: 'trashed' },
  trashed: { restore: 'draft' },
};

/**
 * 回收站恢复统一回到草稿，防止内容在未经再次确认时直接重新公开。
 */
export function transitionStatus(current: ContentStatus, event: ContentEvent): ContentStatus {
  const next = transitions[current][event];

  if (!next) {
    throw new Error(`Cannot ${event} ${current} content`);
  }

  return next;
}
