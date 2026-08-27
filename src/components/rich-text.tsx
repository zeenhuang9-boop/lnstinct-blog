import { Fragment } from 'react';
import type { ReactNode } from 'react';

import type { TiptapDocument, TiptapMark, TiptapNode } from '@/domain/types';

const safeProtocols = new Set(['http:', 'https:', 'mailto:']);

function safeHref(href: unknown): string | null {
  if (typeof href !== 'string' || href.length === 0) {
    return null;
  }

  try {
    return safeProtocols.has(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}

/**
 * 渲染层不信任存储 JSON：即使校验层放过异常数据，未知节点与标记也一律丢弃。
 */
function renderMarks(text: string, marks: readonly TiptapMark[] | undefined, keyPrefix: string): ReactNode {
  let element: React.ReactNode = text;

  for (const mark of marks ?? []) {
    const key = `${keyPrefix}:${mark.type}`;
    switch (mark.type) {
      case 'bold':
        element = <strong key={key}>{element}</strong>;
        break;
      case 'italic':
        element = <em key={key}>{element}</em>;
        break;
      case 'strike':
        element = <s key={key}>{element}</s>;
        break;
      case 'code':
        element = <code key={key}>{element}</code>;
        break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        if (href) {
          element = (
            <a key={key} href={href} rel="noreferrer noopener" target="_blank">
              {element}
            </a>
          );
        }
        break;
      }
      default:
        break;
    }
  }

  return element;
}

function renderInline(nodes: readonly TiptapNode[] | undefined, keyPrefix: string): React.ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === 'text') {
      return <Fragment key={`${keyPrefix}-t${index}`}>{renderMarks(node.text ?? '', node.marks, `${keyPrefix}-t${index}`)}</Fragment>;
    }

    if (node.type === 'hardBreak') {
      return <br key={`${keyPrefix}-b${index}`} />;
    }

    return null;
  });
}

function safeImageSrc(src: unknown): string | null {
  if (typeof src !== 'string' || src.length === 0) {
    return null;
  }

  if (src.startsWith('/') && !src.startsWith('//')) {
    return src;
  }

  try {
    return safeProtocols.has(new URL(src).protocol) ? src : null;
  } catch {
    return null;
  }
}

function renderBlocks(nodes: readonly TiptapNode[] | undefined, keyPrefix: string): React.ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    const key = `${keyPrefix}-${node.type}-${index}`;

    switch (node.type) {
      case 'paragraph':
        return <p key={key}>{renderInline(node.content, key)}</p>;
      case 'heading': {
        const level = node.attrs?.level;
        const clamped = level === 1 || level === 2 || level === 3 ? level : 3;
        const Tag = `h${clamped}` as 'h1' | 'h2' | 'h3';
        return <Tag key={key}>{renderInline(node.content, key)}</Tag>;
      }
      case 'bulletList':
        return <ul key={key}>{renderBlocks(node.content, key)}</ul>;
      case 'orderedList':
        return <ol key={key}>{renderBlocks(node.content, key)}</ol>;
      case 'listItem':
        return <li key={key}>{renderBlocks(node.content, key)}</li>;
      case 'blockquote':
        return <blockquote key={key}>{renderBlocks(node.content, key)}</blockquote>;
      case 'codeBlock':
        return (
          <pre key={key}>
            <code>{(node.content ?? []).map((child) => child.text ?? '').join('')}</code>
          </pre>
        );
      case 'image': {
        const src = safeImageSrc(node.attrs?.src);

        if (!src) {
          return null;
        }

        const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
        const title = typeof node.attrs?.title === 'string' ? node.attrs.title : undefined;

        // 本地媒体已压缩，无需 next/image 二次优化；动态渲染路径下直接输出。
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={key} src={src} alt={alt} title={title} loading="lazy" />;
      }
      default:
        return null;
    }
  });
}

export function RichText({ doc }: { doc: TiptapDocument }) {
  return <div className="rich-text">{renderBlocks(doc.content, 'doc')}</div>;
}
