import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { TiptapDocument } from '@/domain/types';
import { RichText } from '@/components/rich-text';

describe('RichText', () => {
  it('渲染段落、标题与文本样式', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '二级标题' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '正常' },
            { type: 'text', marks: [{ type: 'bold' }], text: '加粗' },
            { type: 'text', marks: [{ type: 'code' }], text: '代码' },
          ],
        },
      ],
    };

    const { container } = render(<RichText doc={doc} />);

    expect(screen.getByRole('heading', { level: 2, name: '二级标题' })).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('加粗');
    expect(container.querySelector('code')?.textContent).toBe('代码');
  });

  it('渲染列表、引用、代码块与硬换行', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '项一' }] }] },
          ],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '引用' }] }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'const a = 1;' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '行一' }, { type: 'hardBreak' }, { type: 'text', text: '行二' }] },
      ],
    };

    const { container } = render(<RichText doc={doc} />);

    expect(container.querySelectorAll('ul li')).toHaveLength(1);
    expect(container.querySelector('blockquote')?.textContent).toContain('引用');
    expect(container.querySelector('pre code')?.textContent).toBe('const a = 1;');
    expect(container.querySelector('br')).toBeInTheDocument();
  });

  it('链接使用受信任协议并输出安全 rel', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              text: '外链',
            },
          ],
        },
      ],
    };

    render(<RichText doc={doc} />);

    const link = screen.getByRole('link', { name: '外链' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('防御性丢弃白名单之外的节点与标记', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'javascript:alert(1)' } },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '安全', marks: [{ type: 'underline' }] },
            { type: 'text', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }], text: '坏链' },
          ],
        },
      ],
    } as unknown as TiptapDocument;

    const { container } = render(<RichText doc={doc} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.textContent).toBe('安全坏链');
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('渲染受信任来源的图片节点', () => {
    const doc: TiptapDocument = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: '/media/photo.webp', alt: '一张照片' } },
      ],
    };

    const { container } = render(<RichText doc={doc} />);
    const image = container.querySelector('img');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/media/photo.webp');
    expect(image).toHaveAttribute('alt', '一张照片');
  });

  it('防御性丢弃不安全的图片节点', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
    } as unknown as TiptapDocument;

    const { container } = render(<RichText doc={doc} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});
