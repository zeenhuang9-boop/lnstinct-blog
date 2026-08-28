import type { PostKind } from '@/domain/types';

export function postKindLabel(kind: PostKind): string {
  return kind === 'learning' ? '学习记录' : '文章';
}
