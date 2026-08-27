import { describe, expect, it } from 'vitest';

import { tiptapContentSchema } from '@/domain/tiptap-content';

describe('tiptapContentSchema', () => {
  it('accepts declared text and paragraph nodes', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('rejects undeclared node types', () => {
    const document = { type: 'doc', content: [{ type: 'table', content: [] }] };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects unsafe link protocols', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Open', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects a doc node nested directly under the root doc', () => {
    const document = { type: 'doc', content: [{ type: 'doc', content: [] }] };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects a doc node in a non-root container', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [{ type: 'doc', content: [] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects marks on a container node', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'paragraph', marks: [{ type: 'bold' }], content: [{ type: 'text', text: 'Hello' }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects text directly under the root doc', () => {
    const document = { type: 'doc', content: [{ type: 'text', text: 'Loose text' }] };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it.each(['bulletList', 'orderedList'])('rejects a paragraph directly inside %s', (listType) => {
    const document = {
      type: 'doc',
      content: [{ type: listType, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wrong child' }] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects content on a text node', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text', content: [] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it.each([
    ['paragraph', {}, { type: 'bulletList', content: [] }],
    ['heading', { level: 2 }, { type: 'blockquote', content: [] }],
    ['codeBlock', {}, { type: 'paragraph', content: [] }],
  ])('rejects a block child inside a %s text block', (textBlockType, attrs, child) => {
    const block = { type: textBlockType, ...(Object.keys(attrs).length > 0 ? { attrs } : {}), content: [child] };
    const document = { type: 'doc', content: [block] };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it.each([
    ['text', { type: 'text', text: 'Loose text' }],
    ['listItem', { type: 'listItem', content: [] }],
  ])('rejects a %s directly inside a listItem', (_childType, invalidChild) => {
    const document = {
      type: 'doc',
      content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [invalidChild] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('accepts block nodes directly inside the root doc', () => {
    const document = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        { type: 'heading', attrs: { level: 1 }, content: [] },
        { type: 'blockquote', content: [] },
        { type: 'codeBlock', content: [] },
      ],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts listItem children inside a list', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts paragraphs and nested lists inside a listItem', () => {
    const document = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Parent item' }] },
            { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [] }] }] },
          ],
        }],
      }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it.each(['paragraph', 'heading', 'codeBlock'])('accepts text and hardBreak inside %s', (textBlockType) => {
    const document = {
      type: 'doc',
      content: [{
        type: textBlockType,
        ...(textBlockType === 'heading' ? { attrs: { level: 2 } } : {}),
        content: [{ type: 'text', text: 'Line one' }, { type: 'hardBreak' }, { type: 'text', text: 'Line two' }],
      }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts block nodes inside a blockquote', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts an image node with a safe src at doc level', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/media/photo.webp', alt: '照片' } }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts the exact JSON Tiptap emits for images (5 attrs, null defaults)', () => {
    const document = {
      type: 'doc',
      content: [{
        type: 'image',
        attrs: { src: '/media/abc.webp', alt: 'pixel.png', title: null, width: null, height: null },
      }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('accepts a Tiptap 编辑器生成的图片节点（alt/title 为 null 默认值）', () => {
    const document = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: '/media/abc-123.png', alt: 'pixel.png', title: null } },
      ],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(true);
  });

  it('rejects an image node with an unsafe protocol', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects an image node with extra unknown attrs', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/media/a.png', onerror: 'alert(1)' } }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects an image node nested inside a paragraph', () => {
    const document = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: '/media/a.png' } }] }],
    };

    expect(tiptapContentSchema.safeParse(document).success).toBe(false);
  });
});
