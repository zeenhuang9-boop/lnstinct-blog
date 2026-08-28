import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RichTextEditor } from '@/components/admin/rich-text-editor';

const headingDocument = {
  type: 'doc' as const,
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '已有标题' }],
    },
  ],
};

describe('RichTextEditor Markdown 模式', () => {
  it('可从富文本切换到 Markdown 源码并保留内容', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor initialContent={headingDocument} onChange={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Markdown' }));

    expect(screen.getByRole('textbox', { name: 'Markdown 正文' })).toHaveValue('# 已有标题');
  });

  it('Markdown 输入会转换成可保存的 Tiptap JSON', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor initialContent={headingDocument} onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: 'Markdown' }));
    const textarea = screen.getByRole('textbox', { name: 'Markdown 正文' });
    await user.clear(textarea);
    await user.type(textarea, '## 学习记录');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '学习记录' }],
          },
        ],
      });
    });
  });
});
