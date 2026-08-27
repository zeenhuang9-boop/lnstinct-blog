import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  it('渲染诚实空状态文案', () => {
    render(<EmptyState title="还没有文章" description="发布后会出现在这里。" />);

    expect(screen.getByText('还没有文章')).toBeInTheDocument();
    expect(screen.getByText('发布后会出现在这里。')).toBeInTheDocument();
  });

  it('可选行动链接存在时渲染', () => {
    render(
      <EmptyState
        title="还没有文章"
        description="发布后会出现在这里。"
        action={{ href: '/about', label: '了解我' }}
      />,
    );

    expect(screen.getByRole('link', { name: '了解我' })).toHaveAttribute('href', '/about');
  });

  it('没有 action 时不渲染链接', () => {
    render(<EmptyState title="空" description="空空如也" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
