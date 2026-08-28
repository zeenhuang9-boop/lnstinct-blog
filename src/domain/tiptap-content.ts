import { z } from 'zod';

import type { TiptapDocument, TiptapMark, TiptapNode } from '@/domain/types';

const allowedNodeTypes = new Set([
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'image',
]);

const allowedMarkTypes = new Set(['bold', 'italic', 'strike', 'code', 'link']);
const safeLinkProtocols = new Set(['http:', 'https:', 'mailto:']);

const blockNodeTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'image']);
const textBlockNodeTypes = new Set(['paragraph', 'heading', 'codeBlock']);
const listNodeTypes = new Set(['bulletList', 'orderedList']);
const inlineNodeTypes = new Set(['text', 'hardBreak']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isSafeLink(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    return safeLinkProtocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isSafeImageSrc(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  // 同源相对路径（本地媒体）或显式 http/https 链接；禁止 javascript: 等协议。
  if (value.startsWith('/')) {
    return !value.startsWith('//');
  }

  try {
    return safeLinkProtocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isAllowedImage(value: Record<string, unknown>): boolean {
  // Tiptap Image 3.30.5 的 addAttributes 输出 src/alt/title/width/height，默认均为 null。
  if (!hasOnlyKeys(value, ['src', 'alt', 'title', 'width', 'height']) || !isSafeImageSrc(value.src)) {
    return false;
  }

  // alt/title 允许 null/undefined/string。
  if (value.alt !== undefined && value.alt !== null && typeof value.alt !== 'string') {
    return false;
  }

  if (value.title !== undefined && value.title !== null && typeof value.title !== 'string') {
    return false;
  }

  // width/height 只允许 null/undefined/有限数字/纯数字字符串，避免注入。
  const dimensionOk = (dimension: unknown): boolean =>
    dimension === undefined
    || dimension === null
    || (typeof dimension === 'number' && Number.isFinite(dimension))
    || (typeof dimension === 'string' && /^\d+$/.test(dimension));

  return dimensionOk(value.width) && dimensionOk(value.height);
}

function isAllowedMark(value: unknown): value is TiptapMark {
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'attrs']) || typeof value.type !== 'string') {
    return false;
  }

  if (!allowedMarkTypes.has(value.type)) {
    return false;
  }

  if (value.type !== 'link') {
    return value.attrs === undefined;
  }

  if (!isRecord(value.attrs) || !hasOnlyKeys(value.attrs, ['href', 'title', 'target', 'rel', 'class']) || !isSafeLink(value.attrs.href)) {
    return false;
  }

  if (value.attrs.title !== undefined && value.attrs.title !== null && typeof value.attrs.title !== 'string') {
    return false;
  }

  if (value.attrs.target !== undefined && value.attrs.target !== null && value.attrs.target !== '_blank') {
    return false;
  }

  if (value.attrs.class !== undefined && value.attrs.class !== null) {
    return false;
  }

  if (value.attrs.rel !== undefined && value.attrs.rel !== null) {
    if (typeof value.attrs.rel !== 'string') {
      return false;
    }

    const allowedRelTokens = new Set(['noreferrer', 'noopener', 'nofollow']);
    const relTokens = value.attrs.rel.split(/\s+/).filter(Boolean);
    if (relTokens.some((token) => !allowedRelTokens.has(token))) {
      return false;
    }
  }

  return true;
}

function permitsChild(parentType: string, childType: string): boolean {
  if (parentType === 'doc' || parentType === 'blockquote') {
    return blockNodeTypes.has(childType);
  }

  if (listNodeTypes.has(parentType)) {
    return childType === 'listItem';
  }

  if (parentType === 'listItem') {
    return childType === 'paragraph' || listNodeTypes.has(childType);
  }

  if (textBlockNodeTypes.has(parentType)) {
    return inlineNodeTypes.has(childType);
  }

  return false;
}

function isAllowedNode(value: unknown, parentType: string): value is TiptapNode {
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'attrs', 'content', 'text', 'marks']) || typeof value.type !== 'string') {
    return false;
  }

  if (!allowedNodeTypes.has(value.type)) {
    return false;
  }

  if (value.type === 'text' && typeof value.text !== 'string') {
    return false;
  }

  if (value.type !== 'text' && value.text !== undefined) {
    return false;
  }

  if (!permitsChild(parentType, value.type)) {
    return false;
  }

  if (value.type === 'heading') {
    if (!isRecord(value.attrs) || !hasOnlyKeys(value.attrs, ['level']) || ![1, 2, 3].includes(value.attrs.level as number)) {
      return false;
    }
  } else if (value.type === 'image') {
    if (!isRecord(value.attrs) || !isAllowedImage(value.attrs)) {
      return false;
    }
  } else if (value.type === 'codeBlock') {
    if (value.attrs !== undefined) {
      if (!isRecord(value.attrs) || !hasOnlyKeys(value.attrs, ['language'])) {
        return false;
      }

      const language = value.attrs.language;
      if (language !== null && language !== undefined && (typeof language !== 'string' || !/^[\w.+-]{1,50}$/.test(language))) {
        return false;
      }
    }
  } else if (value.attrs !== undefined) {
    return false;
  }

  if (value.type !== 'text' && value.marks !== undefined) {
    return false;
  }

  if (value.marks !== undefined && (!Array.isArray(value.marks) || !value.marks.every(isAllowedMark))) {
    return false;
  }

  if (value.type === 'text' || value.type === 'hardBreak' || value.type === 'image') {
    return value.content === undefined;
  }

  const nodeType = value.type;

  return value.content === undefined
    || (Array.isArray(value.content) && value.content.every((child) => isAllowedNode(child, nodeType)));
}

export function isTiptapDocument(value: unknown): value is TiptapDocument {
  return isRecord(value)
    && hasOnlyKeys(value, ['type', 'content'])
    && value.type === 'doc'
    && Array.isArray(value.content)
    && value.content.every((child) => isAllowedNode(child, 'doc'));
}

/**
 * 不直接信任编辑器 JSON：白名单同时限制节点、标记与链接协议，降低存储型脚本注入风险。
 */
export const tiptapContentSchema = z.unknown().refine(isTiptapDocument, {
  message: 'Content must be a supported Tiptap document with safe links',
});
