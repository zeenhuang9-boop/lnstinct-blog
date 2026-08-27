import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteHeader } from '@/components/site-header';

describe('SiteHeader', () => {
  it('渲染主导航链接', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: '主页' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '学习记录' })).toHaveAttribute('href', '/learning');
    expect(screen.getByRole('link', { name: '文章' })).toHaveAttribute('href', '/articles');
    expect(screen.getByRole('link', { name: '项目' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: '关于' })).toHaveAttribute('href', '/about');
  });

  it('站点名称链接回首页', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'lnstinct.' })).toHaveAttribute('href', '/');
  });

  it('移动端导航按钮切换展开状态', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole('button', { name: '打开菜单' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
